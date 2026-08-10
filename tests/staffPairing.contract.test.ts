import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { generateQr } from "../src/lib/qrCode.ts"
import { buildStaffPairingEnvelope } from "../src/server/staffPairing.ts"

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

const route = read("src/pages/api/staff/pairing.ts")
const server = read("src/server/staffPairing.ts")
const client = read("src/components/preact/staff/StaffPairingManager.tsx")
const page = read("src/pages/staff/pair.astro")

test("staff pairing is password-gated and same-origin", () => {
  assert.match(route, /hasStaffQrSession/)
  assert.match(route, /isSameOriginRequest/)
  assert.match(route, /readSmallJsonObject/)
  assert.match(route, /Unauthorized/)
  assert.match(page, /noindex, nofollow, noarchive/)
  assert.match(page, /StaffPairingManager client:load/)
})

test("pairing payload matches the broker-backed Virya Signal V2 contract", () => {
  const expiresAt = 1_785_792_300
  const pairingCode = "pairing-code-abcdefghijklmnopqrstuvwxyz"
  const envelope = buildStaffPairingEnvelope(
    "https://signal-api.virya.music/v1",
    {
      version: 2,
      role: "staff",
      displayName: "Kuba — bramka",
      pairingCode,
      expiresAt,
    },
  )

  assert.equal(envelope.version, 2)
  assert.equal(envelope.role, "staff")
  assert.equal(envelope.displayName, "Kuba — bramka")
  assert.equal(envelope.expiresAt, expiresAt)
  assert.ok(envelope.uri.startsWith("virya-signal://pair?payload="))

  const encoded = new URL(envelope.uri).searchParams.get("payload")
  assert.ok(encoded)
  const decoded = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as Record<string, unknown>
  assert.deepEqual(decoded, {
    version: 2,
    apiBaseUrl: "https://signal-api.virya.music/v1/",
    displayName: "Kuba — bramka",
    role: "staff",
    pairingCode,
    expiresAt,
  })
  assert.equal("bearerToken" in decoded, false)
  assert.ok(Buffer.byteLength(envelope.uri, "utf8") <= 400)

  const qr = generateQr(envelope.uri)
  assert.equal(qr.byteLength, Buffer.byteLength(envelope.uri, "utf8"))
  assert.match(qr.svg, /^<svg /)
})

test("pairing rejects unsafe broker responses", () => {
  const valid = {
    version: 2 as const,
    role: "staff" as const,
    displayName: "Staff",
    pairingCode: "pairing-code-abcdefghijklmnopqrstuvwxyz",
    expiresAt: 1_785_792_300,
  }
  assert.throws(
    () => buildStaffPairingEnvelope("http://signal-api.virya.music/v1/", valid),
    /not configured/,
  )
  assert.throws(
    () => buildStaffPairingEnvelope("https://signal-api.virya.music/v1/", { ...valid, pairingCode: "short" }),
    /Invalid staff pairing broker response/,
  )
  assert.throws(
    () => buildStaffPairingEnvelope("https://signal-api.virya.music/v1/", { ...valid, displayName: "X".repeat(65) }),
    /Invalid staff pairing broker response/,
  )
})

test("server brokers one-time codes without exposing either administrator or device bearer", () => {
  assert.match(server, /CROWDRELAY_ADMIN_API_KEY/)
  assert.match(server, /admin\/staff\/pairing-codes/)
  assert.match(server, /Authorization: `Bearer \$\{adminApiKey\}`/)
  assert.match(server, /pairingCode/)
  assert.doesNotMatch(server, /STAFF_OPERATOR_KEY/)
  assert.doesNotMatch(server, /bearerToken/)
  assert.match(route, /await createStaffPairingEnvelope/)
})

test("browser receives only a short-lived one-time pairing envelope", () => {
  assert.match(client, /\/api\/staff\/pairing/)
  assert.match(client, /\/api\/staff\/qr\/login/)
  assert.match(client, /generateQr\(next\.uri\)/)
  assert.match(client, /setQr\(null\)/)
  assert.match(client, /odwołać niezależnie/)
  assert.doesNotMatch(client, /STAFF_OPERATOR_KEY/)
  assert.doesNotMatch(client, /CROWDRELAY_ADMIN_API_KEY/)
  assert.match(client, /\/api\/staff\/pairing\/sessions/)
  assert.match(client, /revokeSession/)
  assert.doesNotMatch(client, /clipboard|downloadSvg|POBIERZ SVG/)
})
