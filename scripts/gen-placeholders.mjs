// Build-time blur LQIP generator.
// Scans public/ raster images, writes src/placeholders.json: { "/path": "data:image/webp;base64,..." }
// Zero runtime cost; consumed by BlurImage / BlurImg helpers as CSS background.
import sharp from "sharp"
import { readdir, writeFile, mkdir } from "node:fs/promises"
import { join, relative, extname } from "node:path"

const PUBLIC = "public"
const OUT = "src/placeholders.json"
const EXTS = new Set([".webp", ".jpg", ".jpeg", ".png", ".avif"])

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

const out = {}
for await (const file of walk(PUBLIC)) {
  if (!EXTS.has(extname(file).toLowerCase())) continue
  try {
    const buf = await sharp(file)
      .resize(24, 24, { fit: "inside" })
      .blur(8)
      .webp({ quality: 40 })
      .toBuffer()
    const key = "/" + relative(PUBLIC, file).split(/[\\/]/).join("/")
    out[key] = `data:image/webp;base64,${buf.toString("base64")}`
  } catch (e) {
    console.warn("[placeholders] skip", file, e.message)
  }
}

await mkdir("src", { recursive: true })
await writeFile(OUT, JSON.stringify(out))
console.log(`[placeholders] wrote ${Object.keys(out).length} → ${OUT}`)
