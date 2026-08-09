import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const showcase = readFileSync(resolve("src/components/Showcase.astro"), "utf8")
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

expect(showcase.includes('preload="none"'), "showcase video must stay click-to-load")
expect(showcase.includes('btn.classList.add("hidden")'), "showcase launch overlay must leave the video controls")
expect(showcase.includes('video.addEventListener("ended", restorePoster)'), "showcase must restore its poster after playback")
expect(showcase.includes('video.play().catch(restorePoster)'), "showcase must recover if autoplay/playback fails")

if (failures.length) {
  console.error("Virya UI audit failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log("Virya UI audit passed.")
