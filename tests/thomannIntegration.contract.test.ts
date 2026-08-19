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
  const epk = read("src/components/EpkPage.astro")

  assert.match(navbar, /\/gear\//)
  assert.match(footer, /thomannAffiliateUrl\(THOMANN_HOME_URL, "footer"\)/)
  assert.match(endorsements, /thomannAffiliateUrl\(THOMANN_HOME_URL, "partners"\)/)
  assert.match(gearPage, /thomannAffiliateUrl\(item\.thomannUrl, "gear"\)/)
  assert.match(gearPage, /const shopPath = "\/thomann"/)
  assert.match(epk, /thomannAffiliateUrl\(THOMANN_HOME_URL, "epk"\)/)
})

test("Commercial Thomann surfaces are explicitly marked sponsored", () => {
  const expectations = new Map([
    ["src/components/Footer.astro", 1],
    ["src/components/Endorsements.astro", 1],
    // One sponsored anchor lives inside the gear map and therefore covers all
    // rendered product links; the second is the generic shop CTA.
    ["src/components/GearPage.astro", 2],
    ["src/components/EpkPage.astro", 1],
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

test("Friendly Thomann redirect is served at the edge and excluded from the sitemap", () => {
  const netlify = read("netlify.toml")
  const astroConfig = read("astro.config.mjs")

  // The target is constant, so this is an edge redirect rather than an SSR
  // function woken for every click. It must still carry the Signal-scoped
  // affiliate parameters the library builds.
  for (const from of ['from = "/thomann"', 'from = "/pl/thomann"']) {
    assert.match(netlify, new RegExp(from.replace(/[/]/g, "\\/")))
  }
  const targets = netlify.match(/to = "https:\/\/www\.thomann\.pl\/\?[^"]+"/g) ?? []
  assert.equal(targets.length, 2)
  for (const target of targets) {
    assert.match(target, /offid=1/)
    assert.match(target, /affid=4979/)
    assert.match(target, /subid=virya_music/)
    assert.match(target, /subid2=shop/)
  }
  assert.match(netlify, /status = 302/)
  assert.match(astroConfig, /"\/thomann"/)
  assert.match(astroConfig, /"\/pl\/thomann"/)
})
