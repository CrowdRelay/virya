import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const read = path => readFileSync(resolve(path), "utf8")
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

const globalCss = read("src/styles/global.css")
const navbar = read("src/components/Navbar.astro")
const signalPage = read("src/components/SignalPage.astro")
const signalEcosystem = read("src/components/SignalEcosystem.astro")
const ecosystemRail = read("src/components/EcosystemRail.astro")
const showcase = read("src/components/Showcase.astro")
const merch = read("src/components/preact/merch/MerchClient.jsx")
const productCard = read("src/components/preact/merch/productCard.jsx")
const area = read("src/components/AreaExperience.astro")
const staff = read("src/components/preact/staff/AdminConsole.tsx")
const staffTabs = read("src/components/preact/staff/AdminConsoleTabs.tsx")
const autopilot = read("src/components/preact/staff/AutopilotHandoffs.tsx")
const staffOverviewRoute = read("src/pages/api/staff/admin/overview.ts")
const mainText = read("src/components/MainText.astro")

expect(
  globalCss.includes("--virya-signal: #84b4ac") &&
    globalCss.includes("--virya-warning: #f3c51a") &&
    globalCss.includes(".virya-container--wide") &&
    globalCss.includes(".virya-container--prose"),
  "V2 design tokens must keep Seed mint as brand primary, yellow semantic, and use shared containers.",
)

expect(
  !navbar.toLowerCase().includes("synesthesia") &&
    !navbar.toLowerCase().includes("latarnik") &&
    !navbar.includes('lp(lang, "/area/"') &&
    navbar.includes('lang === "pl" ? "Więcej" : "More"'),
  "Public navigation must stay focused: no Synesthesia, Latarnik, or permanent AREA top-level entry.",
)

expect(
  ![signalPage, signalEcosystem, ecosystemRail].some(source => source.toLowerCase().includes("synesthesia")),
  "Public Signal acquisition surfaces must not showcase Synesthesia.",
)

expect(
  showcase.includes('preload="none"') &&
    showcase.includes("prewarmShowcase") &&
    showcase.includes("saveData") &&
    showcase.includes("IntersectionObserver"),
  "Showcase must remain poster-first with adaptive, data-aware prewarming.",
)

expect(
  merch.includes("grid-cols-1") &&
    merch.includes("min-[520px]:grid-cols-2") &&
    merch.includes("lg:grid-cols-3") &&
    !productCard.includes("spotify.com/embed"),
  "Merch must keep a readable mobile grid and avoid embedded third-party Spotify players in product cards.",
)

const mapIndex = area.indexOf('id="area-map"')
const profileIndex = area.indexOf('id="area-profile"')
expect(
  mapIndex >= 0 && profileIndex >= 0 && mapIndex < profileIndex &&
    area.includes('id="area-collection"') &&
    area.includes('id="area-rewards"') &&
    !area.includes('id="how-it-works"') &&
    !area.includes("copy.rules.chain"),
  "AREA must keep Hunt/Collection/Rewards flow, exploration before login, and hide low-value implementation detail.",
)

expect(
  !staff.includes('case "ops"') &&
    !staff.includes('case "system"') &&
    !staff.includes('case "mailer"') &&
    !staff.includes("CrowdRelay API") &&
    !staffTabs.includes("CrowdRelay API") &&
    staff.includes("Dzisiaj w VIRYA"),
  "Normal Staff navigation must remain action-first and free of technical observability tabs.",
)

expect(
  !autopilot.match(/n8n|attest|heartbeat|manifest drift|release_ledger/i) &&
    !staffOverviewRoute.match(/health\/(?:live|ready)|public\/push\/config/),
  "Normal Staff must not fetch or render executor/readiness observability that belongs in Control Plane.",
)

expect(!mainText.includes("<script"), "Homepage editorial hero copy must stay static and hydration-free.")

if (failures.length) {
  console.error("VIRYA V2 audit failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log("VIRYA V2 audit passed.")
