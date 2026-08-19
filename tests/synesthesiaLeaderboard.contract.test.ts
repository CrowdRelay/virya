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

test("leaderboard stays available in Signal but is deliberately demoted from the homepage", () => {
  assert.match(signalPage, /<SynesthesiaLeaderboard lang=\{lang\} \/>/)
  assert.doesNotMatch(ecosystem, /<SynesthesiaLeaderboard/)
  assert.match(ecosystem, /Albumowy eksperyment: Synesthesia/)
  assert.match(ecosystem, /Interactive album experiment: Synesthesia/)
  assert.doesNotMatch(ecosystemRail, /\["synesthesia"/)
  assert.match(ecosystemRail, /Albumowy eksperyment: Synesthesia/)
  assert.match(ecosystemRail, /Album experiment: Synesthesia/)
  assert.doesNotMatch(signalPage, /SynesthesiaLeaderboard[^\n]+client:/)
})
