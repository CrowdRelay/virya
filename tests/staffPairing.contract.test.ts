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

test("pairing payload matches the Virya Signal V1 contract", () => {
  const now = 1_785_792_000
  const token = "staff-token-abcdefghijklmnopqrstuvwxyz-123456"
  const envelope = buildStaffPairingEnvelope(
    {
      bearerToken: token,
      apiBaseUrl: "https://signal-api.virya.music/v1",
    },
    "  Kuba   — bramka  ",
    5,
    now,
  )

  assert.equal(envelope.version, 1)
  assert.equal(envelope.role, "staff")
  assert.equal(envelope.displayName, "Kuba — bramka")
  assert.equal(envelope.expiresAt, now + 300)
  assert.ok(envelope.uri.startsWith("virya-signal://pair?payload="))

  const encoded = new URL(envelope.uri).searchParams.get("payload")
  assert.ok(encoded)
  const decoded = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as Record<string, unknown>
  assert.deepEqual(decoded, {
    version: 1,
    apiBaseUrl: "https://signal-api.virya.music/v1/",
    displayName: "Kuba — bramka",
    role: "staff",
    bearerToken: token,
    expiresAt: now + 300,
  })
  assert.ok(Buffer.byteLength(envelope.uri, "utf8") <= 400)

  const qr = generateQr(envelope.uri)
  assert.equal(qr.byteLength, Buffer.byteLength(envelope.uri, "utf8"))
  assert.equal(qr.version, 15)
  assert.match(qr.svg, /^<svg /)
  assert.doesNotMatch(server, /CROWDRELAY_ADMIN_API_KEY/)
})

test("pairing rejects unsafe profiles", () => {
  const validConfig = {
    bearerToken: "staff-token-abcdefghijklmnopqrstuvwxyz-123456",
    apiBaseUrl: "https://signal-api.virya.music/v1/",
  }
  assert.throws(
    () => buildStaffPairingEnvelope(validConfig, "Staff", 11),
    /Invalid staff pairing input/,
  )
  assert.throws(
    () =>
      buildStaffPairingEnvelope(
        { ...validConfig, apiBaseUrl: "http://signal-api.virya.music/v1/" },
        "Staff",
        5,
      ),
    /not configured/,
  )
  assert.throws(
    () =>
      buildStaffPairingEnvelope(
        { ...validConfig, bearerToken: "short" },
        "Staff",
        5,
      ),
    /not configured/,
  )
  assert.throws(
    () =>
      buildStaffPairingEnvelope(
        { ...validConfig, bearerToken: "x".repeat(180) },
        "X".repeat(64),
        10,
      ),
    /too large/,
  )
})

test("browser receives the envelope only after authentication", () => {
  assert.match(client, /\/api\/staff\/pairing/)
  assert.match(client, /\/api\/staff\/qr\/login/)
  assert.match(client, /generateQr\(next\.uri\)/)
  assert.match(client, /setQr\(null\)/)
  assert.match(client, /Odebranie dostępu wymaga rotacji klucza staff/)
  assert.doesNotMatch(client, /CROWDRELAY_STAFF_API_KEY/)
  assert.doesNotMatch(client, /CROWDRELAY_ADMIN_API_KEY/)
  assert.doesNotMatch(client, /clipboard|downloadSvg|POBIERZ SVG/)
})
