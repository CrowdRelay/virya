import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const showcase = readFileSync(resolve("src/components/Showcase.astro"), "utf8")
const music = readFileSync(resolve("src/pages/music/[slug].astro"), "utf8")
const musicPl = readFileSync(resolve("src/pages/pl/music/[slug].astro"), "utf8")
const videos = readFileSync(resolve("src/pages/videos.astro"), "utf8")
const videosPl = readFileSync(resolve("src/pages/pl/videos.astro"), "utf8")
const gallery = readFileSync(resolve("src/pages/gallery.astro"), "utf8")
const galleryPl = readFileSync(resolve("src/pages/pl/gallery.astro"), "utf8")
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

expect(showcase.includes('preload="none"'), "showcase video must stay click-to-load")
expect(showcase.includes('btn.classList.add("hidden")'), "showcase launch overlay must leave the video controls")
expect(showcase.includes('video.addEventListener("ended", restorePoster)'), "showcase must restore its poster after playback")
expect(showcase.includes('video.play().catch(restorePoster)'), "showcase must recover if autoplay/playback fails")
for (const [label, source] of [["music", music], ["music-pl", musicPl]]) {
  expect(source.includes("new AbortController()"), `${label} lightbox listeners must be lifecycle-bound`)
  expect(source.includes("astro:before-preparation"), `${label} lightbox must clean up before navigation`)
  expect(source.includes("dataset.initialized"), `${label} lightbox must be idempotent across Astro page-load`)
  expect(source.includes("createDialogFocus"), `${label} lightbox must trap and restore keyboard focus`)
  expect(source.includes("data-dialog-initial-focus"), `${label} lightbox must expose a deterministic initial focus target`)
}


for (const [label, source] of [["videos", videos], ["videos-pl", videosPl], ["gallery", gallery], ["gallery-pl", galleryPl]]) {
  expect(source.includes("astro:before-preparation"), `${label} modal must clean up before Astro navigation`)
  expect(source.includes("closeModal(); ac.abort()"), `${label} modal must release body/focus state before navigation`)
}
for (const [label, source] of [["videos", videos], ["videos-pl", videosPl]]) {
  expect(source.includes("modal.dataset.initialized"), `${label} modal must be idempotent across Astro page-load`)
}

if (failures.length) {
  console.error("Virya UI audit failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log("Virya UI audit passed.")
