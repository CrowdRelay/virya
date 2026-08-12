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

test("Synesthesia leaderboard is public, privacy-safe and lazy", () => {
  assert.match(leaderboard, /\/v1\/public\/synesthesia\/leaderboard\?limit=/)
  assert.match(leaderboard, /IntersectionObserver/)
  assert.match(leaderboard, /rootMargin: "240px 0px"/)
  assert.match(leaderboard, /display_name/)
  assert.match(leaderboard, /elapsed_ms/)
  assert.doesNotMatch(leaderboard, /fan_id|email|run_id/)
  assert.match(leaderboard, /publikacja jest dobrowolna/i)
})

test("leaderboard is wired into Signal and the homepage ecosystem without hydration", () => {
  assert.match(signalPage, /<SynesthesiaLeaderboard lang=\{lang\} \/>/)
  assert.match(ecosystem, /<SynesthesiaLeaderboard lang=\{lang\} compact=\{true\} limit=\{5\} \/>/)
  assert.doesNotMatch(signalPage, /SynesthesiaLeaderboard[^\n]+client:/)
  assert.doesNotMatch(ecosystem, /SynesthesiaLeaderboard[^\n]+client:/)
})
