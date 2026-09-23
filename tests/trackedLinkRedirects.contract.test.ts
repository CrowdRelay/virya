import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

// CrowdRelay executors publish tracked links as https://virya.music/l/{slug}
// while the resolver is GET /v1/go/{slug} — the /l/* edge rule is what makes a
// published link resolve instead of 404ing. This guards both spellings.
test("_redirects routes /go/* and /l/* to the CrowdRelay resolver", () => {
  const lines = read("public/_redirects")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))

  const rules = new Map(
    lines.map((line) => {
      const [from, to, status] = line.split(/\s+/)
      return [from, { to, status }]
    }),
  )

  for (const from of ["/go/*", "/l/*"]) {
    const rule = rules.get(from)
    assert.ok(rule, `missing redirect rule for ${from}`)
    assert.equal(rule.to, "https://signal-api.virya.music/v1/go/:splat")
    assert.equal(rule.status, "302!")
  }
})
