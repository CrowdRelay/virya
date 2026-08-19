import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const read = path => readFileSync(resolve(path), "utf8")
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

const home = read("src/pages/index.astro")
const homePl = read("src/pages/pl/index.astro")
const layout = read("src/components/Layout.astro")
const landing = read("src/components/Landing.astro")
const showcase = read("src/components/Showcase.astro")
const spotify = read("src/components/Spotify.astro")
const navbar = read("src/components/Navbar.astro")
const mainText = read("src/components/MainText.astro")
const merch = read("src/components/MerchTeaser.astro")
const endorsements = read("src/components/Endorsements.astro")
const liveCard = read("src/components/preact/LiveEventCard.tsx")
const llms = read("public/llms.txt")
const astroConfig = read("astro.config.mjs")
const scrollToTop = read("src/components/ScrollToTop.astro")
const portfolio = read("src/components/Portfolio.astro")

for (const [label, source] of [["en", home], ["pl", homePl]]) {
  expect(
    source.includes("enableClientRouter={false}"),
    `${label} homepage must not ship Astro ClientRouter/prefetch runtime on the initial document.`,
  )
  expect(
    source.includes("<Shows lang={lang}") && !source.match(/<Shows\s+client:/),
    `${label} homepage Shows must be prerendered without client hydration.`,
  )
  expect(
    !source.match(/client:(?:load|idle)\b/),
    `${label} homepage must not eagerly hydrate an island.`,
  )
}

expect(
  layout.includes("enableClientRouter = true") &&
    layout.includes("enableClientRouter && <ClientRouter />"),
  "ClientRouter must remain opt-in per rendered page so interactive routes keep navigation behavior without taxing home.",
)
expect(
  layout.includes("transform:scaleX(0)") &&
    layout.includes("scaleX(.85)") &&
    !layout.includes("transition = 'width") &&
    !layout.includes("style.width"),
  "Navigation progress must animate compositor-friendly transform rather than layout-affecting width.",
)
expect(
  landing.includes('id="hero-poster"') &&
    landing.includes('fetchpriority="high"') &&
    landing.includes('data-webm="/rise.webm"') &&
    landing.includes('data-mp4="/rise.mp4"') &&
    !landing.includes('<source src="/rise.') &&
    landing.includes('window.addEventListener("pointermove", startVideo') &&
    landing.includes('window.addEventListener("scroll", startVideo') &&
    !landing.includes("setTimeout(startVideo") &&
    landing.includes("initHeroVideo()"),
  "Hero must keep the responsive poster as stable LCP and defer exactly one selected video source until genuine user activity.",
)
expect(
  showcase.includes("initShowcase()") && showcase.includes("prewarmShowcase") && showcase.includes("saveData"),
  "Showcase must keep adaptive poster-first prewarming and initialize on router-free home.",
)

expect(
  astroConfig.includes("prefetch: false") &&
    astroConfig.includes('inlineStylesheets: "always"'),
  "Homepage performance contract must avoid the global Astro prefetch runtime and external render-blocking CSS.",
)
expect(
  !scrollToTop.match(/offsetHeight|getBoundingClientRect|scrollHeight/) &&
    scrollToTop.includes("window.scrollY < window.innerHeight"),
  "Scroll-to-top must not force layout reads during scrolling.",
)
expect(
  showcase.includes('kind="captions"') &&
    showcase.includes('data-webm="/showcase-web.webm"') &&
    showcase.includes("attachBestSource") &&
    !showcase.includes('<source src="/showcase-web.'),
  "Showcase must expose captions and attach only one selected media source.",
)
expect(
  portfolio.includes('aria-label={`${t(lang, "music.watch")}: ${item.title}`}'),
  "Repeated music actions must have release-specific accessible names.",
)
expect(
  spotify.includes('iframe.loading = "lazy"') &&
    spotify.includes('rootMargin: "200px"') &&
    spotify.includes("initSpotify()"),
  "Spotify embed must stay below-fold, lazy and router-independent.",
)
expect(
  navbar.includes('activePage === "home" ? `#${section}`') &&
    navbar.includes('"text-zinc-400 hover:text-zinc-100"'),
  "Homepage nav must use canonical same-document hashes and keep language controls at accessible contrast.",
)
expect(
  !mainText.includes('aria-label={t(lang, "hero.listenAria")}'),
  "Hero primary CTA must expose its visible destination label instead of a mismatched accessible name.",
)
expect(
  !merch.includes("text-zinc-500") && !endorsements.includes("text-zinc-600"),
  "Homepage secondary text must not regress to low-contrast zinc-500/600 on the near-black V2 surface.",
)
expect(
  liveCard.includes("aria-label={`${labels.details}: ${event.title}") &&
    liveCard.includes("aria-label={`${labels.tickets}: ${event.title}") &&
    liveCard.includes("aria-label={`${labels.calendar}: ${event.title}"),
  "Repeated event actions must have event-specific accessible names so identical labels never target different destinations.",
)
expect(
  /^#\s+VIRYA\s*$/m.test(llms) &&
    /^>\s+\S+/m.test(llms) &&
    /^##\s+\S+/m.test(llms) &&
    /^\s*-\s+\[[^\]]+\]\(https:\/\/[^)]+\)(?::\s+.+)?$/m.test(llms),
  "llms.txt must follow the llms.txt Markdown shape with an H1, summary, H2 file list, and at least one descriptive Markdown link.",
)

if (failures.length) {
  console.error("VIRYA Lighthouse regression audit failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log("VIRYA Lighthouse regression audit passed.")
