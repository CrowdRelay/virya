import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { CrowdRelayClient } from "../src/lib/crowdrelay-client.ts"

test("signed-in Signal fan can read and answer only their own Latarnik role", async () => {
  const calls: Array<{ url: string; method: string; body: unknown; key: string | null }> = []
  const client = new CrowdRelayClient({
    baseUrl: "https://signal-api.virya.music/v1/",
    fetch: async (url, options) => {
      const method = options?.method ?? "GET"
      const headers = new Headers(options?.headers)
      calls.push({
        url: String(url),
        method,
        body: options?.body ? JSON.parse(String(options.body)) : null,
        key: headers.get("Idempotency-Key"),
      })
      assert.equal(options?.credentials, "include")
      return method === "GET"
        ? Response.json({ state: "invited" })
        : Response.json({ status: "active" })
    },
  })

  assert.deepEqual(await client.getMyLatarnik(), { state: "invited" })
  assert.deepEqual(
    await client.answerMyLatarnik("accept", "latarnik-answer-1"),
    { status: "active" },
  )

  assert.deepEqual(calls, [
    {
      url: "https://signal-api.virya.music/v1/me/latarnik",
      method: "GET",
      body: null,
      key: null,
    },
    {
      url: "https://signal-api.virya.music/v1/me/latarnik/answer",
      method: "POST",
      body: { answer: "accept" },
      key: "latarnik-answer-1",
    },
  ])
})

test("My Signal closes the invite-to-one-person referral loop", () => {
  const signal = readFileSync(
    new URL("../src/components/preact/signal/MySignal.tsx", import.meta.url),
    "utf8",
  )
  const copy = readFileSync(
    new URL("../src/data/signalCopy.ts", import.meta.url),
    "utf8",
  )

  assert.match(signal, /crowdrelay\.getMyLatarnik\(\)/)
  assert.match(signal, /answerLatarnik\("accept"\)/)
  assert.match(signal, /shareLatarnikReferral/)
  assert.match(signal, /current\.state !== expected/)
  assert.match(copy, /quality beats volume/)
  assert.match(copy, /jakość jest ważniejsza niż liczba/)
})
