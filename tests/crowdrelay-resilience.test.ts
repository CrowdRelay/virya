import assert from "node:assert/strict"
import test from "node:test"
import { CrowdRelayClient, CrowdRelayError } from "../src/lib/crowdrelay-client.ts"

test("safe GET requests retry one transient 503", async () => {
  let attempts = 0
  const client = new CrowdRelayClient({
    baseUrl: "https://signal-api.virya.music/v1/",
    fetch: async () => {
      attempts += 1
      if (attempts === 1) return new Response("busy", { status: 503 })
      return Response.json({ items: [{ slug: "wroclaw", name: "Wrocław", country_code: "PL", fan_count: 1 }] })
    },
  })

  const cities = await client.listCities(100)
  assert.equal(attempts, 2)
  assert.equal(cities[0]?.slug, "wroclaw")
})

test("mutating POST requests are never retried implicitly", async () => {
  let attempts = 0
  const client = new CrowdRelayClient({
    baseUrl: "https://signal-api.virya.music/v1/",
    fetch: async () => {
      attempts += 1
      return new Response("busy", { status: 503 })
    },
  })

  await assert.rejects(
    client.signupFan({
      email: "fan@example.com",
      city_slug: "wroclaw",
      consent: { marketing: true, policy_version: "test" },
    }),
    (error: unknown) => error instanceof CrowdRelayError && error.status === 503,
  )
  assert.equal(attempts, 1)
})
