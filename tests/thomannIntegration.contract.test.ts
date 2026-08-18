import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("Thomann affiliate integration is exposed through the expected public surfaces", () => {
  const navbar = read("src/components/Navbar.astro")
  const footer = read("src/components/Footer.astro")
  const endorsements = read("src/components/Endorsements.astro")
  const gearPage = read("src/components/GearPage.astro")
  const epk = read("src/pages/epk.astro")
  const epkPl = read("src/pages/pl/epk.astro")

  assert.match(navbar, /\/gear\//)
  assert.match(footer, /thomannAffiliateUrl\(THOMANN_HOME_URL, "footer"\)/)
  assert.match(endorsements, /thomannAffiliateUrl\(THOMANN_HOME_URL, "partners"\)/)
  assert.match(gearPage, /thomannAffiliateUrl\(item\.thomannUrl, "gear"\)/)
  assert.match(gearPage, /virya\.music\/thomann/)
  assert.match(epk, /thomannAffiliateUrl\(THOMANN_HOME_URL, "epk"\)/)
  assert.match(epkPl, /thomannAffiliateUrl\(THOMANN_HOME_URL, "epk"\)/)
})

test("Commercial Thomann surfaces are explicitly marked sponsored", () => {
  const expectations = new Map([
    ["src/components/Footer.astro", 1],
    ["src/components/Endorsements.astro", 1],
    ["src/components/GearPage.astro", 3],
    ["src/pages/epk.astro", 1],
    ["src/pages/pl/epk.astro", 1],
  ])

  for (const [path, minimum] of expectations) {
    const source = read(path)
    const sponsored = source.match(/rel="[^"]*sponsored[^"]*"/g) ?? []
    assert.ok(
      sponsored.length >= minimum,
      `${path} should mark Thomann commerce links as sponsored`,
    )
  }
})

test("Friendly Thomann redirect is dynamic and excluded from the sitemap", () => {
  const route = read("src/pages/thomann.ts")
  const routePl = read("src/pages/pl/thomann.ts")
  const astroConfig = read("astro.config.mjs")

  for (const source of [route, routePl]) {
    assert.match(source, /status: 302/)
    assert.match(source, /thomannAffiliateUrl\(THOMANN_HOME_URL, "shop"\)/)
    assert.match(source, /"cache-control": "no-store"/)
  }
  assert.match(astroConfig, /"\/thomann"/)
  assert.match(astroConfig, /"\/pl\/thomann"/)
})
