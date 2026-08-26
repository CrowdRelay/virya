import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const panel = read("src/components/preact/staff/StaffLatarnikNetworkManager.tsx")
const manager = read("src/components/preact/staff/StaffCommerceManager.tsx")
const overview = read("src/pages/api/staff/commerce/overview.ts")
const campaigns = read("src/pages/api/staff/commerce/campaigns.ts")

test("Latarnik network reuses the existing commerce BFF instead of adding a route", () => {
  assert.match(manager, /StaffLatarnikNetworkManager/)
  assert.match(overview, /admin\/autopilot\/beacon-network/)
  assert.match(campaigns, /record\.kind === "beacon_network"/)
  assert.match(panel, /\/api\/staff\/commerce\/campaigns/)
  assert.doesNotMatch(panel, /\/api\/staff\/latarnik\/network/)
})

test("public discovery remains research until explicit reviewed consent evidence", () => {
  assert.match(panel, /Publiczny e-mail nie jest zgodą na marketing/)
  assert.match(panel, /Źródło i tożsamość są zweryfikowane/)
  assert.match(panel, /Mam dowód zgody na marketing e-mail/)
  assert.match(panel, /HTTPS URL dowodu zgody marketingowej/)
  assert.match(campaigns, /record\.sourceVerified !== true/)
  assert.match(campaigns, /record\.marketingEmailConsentConfirmed !== true/)
  assert.match(campaigns, /parsed\.protocol === "https:"/)
})

test("a manually minted Latarnik can be given the home city its radar needs", () => {
  const beacons = read("src/components/preact/staff/StaffBeaconsManager.tsx")
  assert.match(beacons, /public\/cities\?limit=100/)
  assert.match(beacons, /citySlug: testCity/)
  assert.match(campaigns, /city_slug: citySlug/)
  // A city id and a city slug in one request would silently pick a winner.
  assert.match(campaigns, /citySlug !== "" && \(cityId !== null/)
})

test("staff can request Polish discovery and invite only approved selected candidates", () => {
  assert.match(panel, /SZUKAJ LATARNIKÓW PL/)
  assert.match(panel, /countryCode: "PL"/)
  assert.match(panel, /WYŚLIJ ZAPROSZENIA/)
  assert.match(panel, /PODGLĄD/)
  assert.match(panel, /selectedApproved/)
  assert.match(campaigns, /action === "queue_invites"/)
  assert.match(campaigns, /unique\.length > 200/)
  assert.match(campaigns, /beaconIds: unique/)
})

test("network executor unavailability is fail-closed and visible to staff", () => {
  assert.match(panel, /status === 503/)
  assert.match(panel, /Nic nie zostało wysłane ani obiecane/)
  assert.match(overview, /pendingCandidates: \[\], approvedCandidates: \[\], inviteJobs: \[\]/)
})

test("staff previews exact waves and keeps one-time QR only in component state", () => {
  assert.match(panel, /action: "preview_invites"/)
  assert.match(panel, /tokensMinted !== false/)
  assert.match(panel, /Najpierw zrób aktualny PODGLĄD/)
  assert.match(panel, /selectedApproved\.length > 50/)
  assert.match(panel, /action: "single_invite"/)
  assert.match(panel, /qrDataUrl\(value\.inviteUrl/)
  assert.match(panel, /setInviteQr\(null\)/)
  assert.match(panel, /QR i link nie są zapisywane przez panel/)
})

test("invite job rows surface product conversion rather than mail-open tracking", () => {
  for (const field of ["activeCount", "webCount", "androidCount", "pushEnabledCount", "helpingCount", "coverageCount"]) {
    assert.match(panel, new RegExp(`job\\.${field}`))
  }
  assert.doesNotMatch(panel, /tracking pixel|open rate/i)
})
