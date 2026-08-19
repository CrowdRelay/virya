import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { extname, join } from "node:path"
import test from "node:test"

const SRC = new URL("../src/", import.meta.url)

function files(root: URL): string[] {
  const path = root.pathname
  const out: string[] = []
  for (const entry of readdirSync(path)) {
    const child = join(path, entry)
    if (statSync(child).isDirectory())
      out.push(...files(new URL(`file://${child}/`)))
    else out.push(child)
  }
  return out
}

test("public hydration stays deliberately sparse", () => {
  const astro = files(SRC).filter(path =>
    extname(path) === ".astro" && !path.includes("/pages/staff/"),
  )
  const source = astro.map(path => readFileSync(path, "utf8")).join("\n")
  const directives = source.match(/client:(?:load|idle|visible|media|only)/g) ?? []
  const eager = source.match(/client:load/g) ?? []
  assert.ok(directives.length <= 18, `public hydrated islands grew to ${directives.length}`)
  assert.ok(eager.length <= 8, `public eager hydrated islands grew to ${eager.length}`)
  assert.match(source, /client:visible/)
  assert.match(source, /client:idle/)
})

test("private Staff hydration stays bounded independently from the public budget", () => {
  const staffRoot = new URL("../src/pages/staff/", import.meta.url)
  const astro = files(staffRoot).filter(path => extname(path) === ".astro")
  const source = astro.map(path => readFileSync(path, "utf8")).join("\n")
  const directives = source.match(/client:(?:load|idle|visible|media|only)/g) ?? []
  assert.ok(directives.length <= 6, `Staff hydrated islands grew to ${directives.length}`)
})

test("fan dashboard renders from one private read-model before enrichment", () => {
  const client = readFileSync(
    new URL("../src/lib/crowdrelay-client.ts", import.meta.url),
    "utf8",
  )
  const signal = readFileSync(
    new URL("../src/components/preact/signal/MySignal.tsx", import.meta.url),
    "utf8",
  )
  assert.match(client, /"me\/home"/)
  assert.match(signal, /home = await crowdrelay\.getFanHome\(\)/)
  assert.match(signal, /detailsLoading: true/)
  assert.match(
    signal,
    /Promise\.allSettled\(\[\s*crowdrelay\.getReferralProgress\(\),\s*crowdrelay\.listMyEvents\(\),\s*crowdrelay\.getMyAdmissionPass\(\)/s,
  )
  assert.doesNotMatch(
    signal,
    /Promise\.allSettled\(\[\s*crowdrelay\.getFanHome\(\)/s,
  )
})

test("event detail enriches from private context without blocking public render", () => {
  const client = readFileSync(
    new URL("../src/lib/crowdrelay-client.ts", import.meta.url),
    "utf8",
  )
  const detail = readFileSync(
    new URL("../src/components/preact/signal/EventDetail.tsx", import.meta.url),
    "utf8",
  )
  assert.match(client, /me\/events\/\$\{encodeURIComponent\(slug\)\}\/context/)
  assert.match(detail, /crowdrelay\s*\.getFanEventContext\(slug\)/)
  assert.match(
    detail,
    /error instanceof CrowdRelayError\s*&&\s*error\.status === 401/,
  )
  assert.match(detail, /Public event rendering remains fully/)
})
