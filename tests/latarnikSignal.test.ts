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
      const href = String(url)
      if (method === "GET" && href.endsWith("/me/latarnik/mission")) {
        return Response.json({
          mission: {
            id: "01990000-0000-7000-8000-000000000099",
            kind: "show_one_person",
            prompt: "Znasz jedną osobę, którą zabrałbyś na VIRYA?",
            share_text: "VIRYA — Wrocław, 14.06. Szczegóły: https://virya.music/r/ref123",
            status: "offered",
            expires_at: "2026-10-12T12:00:00Z",
          },
        })
      }
      if (method === "GET") return Response.json({ state: "invited" })
      if (href.includes("/mission/")) return Response.json({ recorded: true })
      return Response.json({ status: "active" })
    },
  })

  assert.deepEqual(await client.getMyLatarnik(), { state: "invited" })
  assert.deepEqual(
    await client.answerMyLatarnik("accept", "latarnik-answer-1"),
    { status: "active" },
  )
  const mission = await client.getMyLatarnikMission()
  assert.equal(mission.mission?.kind, "show_one_person")
  assert.equal(
    (
      await client.answerMyLatarnikMission(
        "01990000-0000-7000-8000-000000000099",
        "tap",
        "latarnik-mission-tap-1",
      )
    ).recorded,
    true,
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
    {
      url: "https://signal-api.virya.music/v1/me/latarnik/mission",
      method: "GET",
      body: null,
      key: null,
    },
    {
      url: "https://signal-api.virya.music/v1/me/latarnik/mission/01990000-0000-7000-8000-000000000099/answer",
      method: "POST",
      body: { answer: "tap" },
      key: "latarnik-mission-tap-1",
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
  assert.match(signal, /crowdrelay\.getMyLatarnikMission\(\)/)
  assert.match(signal, /shareLatarnikMission/)
  assert.match(signal, /answerMyLatarnikMission\(mission\.id, "tap"\)/)
  assert.match(signal, /shareLatarnikReferral/)
  assert.match(signal, /missionApi === "available"/)
  assert.match(signal, /current\.state !== expected/)
  assert.match(copy, /quality beats volume/)
  assert.match(copy, /jakość jest ważniejsza niż liczba/)
})
