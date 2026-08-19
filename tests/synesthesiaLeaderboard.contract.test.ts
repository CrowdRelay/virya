import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const leaderboard = readFileSync(
  new URL("../src/components/SynesthesiaLeaderboard.astro", import.meta.url),
  "utf8",
)
const signalPage = readFileSync(
  new URL("../src/components/SignalPage.astro", import.meta.url),
  "utf8",
)
const ecosystem = readFileSync(
  new URL("../src/components/SignalEcosystem.astro", import.meta.url),
  "utf8",
)
const ecosystemRail = readFileSync(
  new URL("../src/components/EcosystemRail.astro", import.meta.url),
  "utf8",
)

test("Synesthesia leaderboard is public, privacy-safe and lazy", () => {
  assert.match(leaderboard, /\/v1\/public\/synesthesia\/leaderboard\?limit=/)
  assert.match(leaderboard, /IntersectionObserver/)
  assert.match(leaderboard, /rootMargin: "240px 0px"/)
  assert.match(leaderboard, /display_name/)
  assert.match(leaderboard, /elapsed_ms/)
  assert.doesNotMatch(leaderboard, /fan_id|email|run_id/)
  assert.match(leaderboard, /publikacja jest dobrowolna/i)
})

test("Synesthesia is hidden from public acquisition surfaces while remaining available inside Signal", () => {
  const mySignal = readFileSync(
    new URL("../src/components/preact/signal/MySignal.tsx", import.meta.url),
    "utf8",
  )
  for (const source of [signalPage, ecosystem, ecosystemRail]) {
    assert.doesNotMatch(source, /Synesthesia|synesthesia/)
  }
  assert.match(mySignal, /synesthesia\.virya\.music/)
  assert.match(mySignal, /synesthesia\.rooms_completed/)
})
