// Build-time image processor.
// 1. Scans public/ rasters → src/placeholders.json: { "/path": "data:image/webp;base64,..." } (blur LQIP)
// 2. Generates public/resp/**/*-{w}w.webp responsive variants → src/srcsets.json: { "/path": "srcset string" }
import sharp from "sharp"
import { readdir, writeFile, mkdir, rm } from "node:fs/promises"
import { join, relative, extname, basename, dirname } from "node:path"

const PUBLIC = "public"
const RESP_DIR = join("public", "resp")
const PH_OUT = "src/placeholders.json"
const SS_OUT = "src/srcsets.json"
const DIM_OUT = "src/imageDimensions.json"
const EXTS = new Set([".webp", ".jpg", ".jpeg", ".png", ".avif"])
const WIDTHS = [400, 800, 1200, 1600]
const MIN_RESPONSIVE = 200
const CONCURRENCY = Math.max(1, Math.min(4, Number(process.env.IMAGE_JOBS) || 4))

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (p === RESP_DIR) continue
      yield* walk(p)
    } else yield p
  }
}

await mkdir("src", { recursive: true })
await rm(RESP_DIR, { recursive: true, force: true })
await mkdir(RESP_DIR, { recursive: true })

const placeholders = {}
const srcsets = {}
const dimensions = {}
const files = []

for await (const file of walk(PUBLIC)) {
  if (!EXTS.has(extname(file).toLowerCase())) continue
  files.push(file)
}

async function processImage(file) {
  const key = "/" + relative(PUBLIC, file).split(/[\\/]/).join("/")

  try {
    const meta = await sharp(file).metadata()
    const nativeW = meta.width || 0
    dimensions[key] = { w: meta.width || 0, h: meta.height || 0 }

    const placeholderTask = sharp(file)
      .resize(24, 24, { fit: "inside" })
      .blur(8)
      .webp({ quality: 40 })
      .toBuffer()

    if (nativeW >= MIN_RESPONSIVE) {
      const rel = relative(PUBLIC, file).split(/[\\/]/).join("/")
      const relDir = dirname(rel)
      const base = basename(rel, extname(rel))
      const outDir = relDir === "." ? RESP_DIR : join(RESP_DIR, relDir)
      await mkdir(outDir, { recursive: true })

      const urlPrefix = relDir === "." ? `/resp/${base}` : `/resp/${relDir}/${base}`
      const parts = []
      const variantTasks = []

      for (const w of WIDTHS) {
        if (w >= nativeW) continue
        variantTasks.push(
          sharp(file)
            .resize(w, null, { withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(join(outDir, `${base}-${w}w.webp`))
        )
        parts.push(`${urlPrefix}-${w}w.webp ${w}w`)
      }

      if (parts.length > 0) {
        parts.push(`${key} ${nativeW}w`)
        srcsets[key] = parts.join(", ")
      }
      await Promise.all(variantTasks)
    }

    const buf = await placeholderTask
    placeholders[key] = `data:image/webp;base64,${buf.toString("base64")}`
  } catch (e) {
    console.warn("[gen] skip", file, e.message)
  }
}

let nextFile = 0
async function worker() {
  while (nextFile < files.length) {
    const file = files[nextFile]
    nextFile += 1
    await processImage(file)
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker))

const stable = (record) =>
  Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]))

await writeFile(PH_OUT, JSON.stringify(stable(placeholders)))
await writeFile(SS_OUT, JSON.stringify(stable(srcsets)))
await writeFile(DIM_OUT, JSON.stringify(stable(dimensions)))
console.log(`[placeholders] ${Object.keys(placeholders).length} → ${PH_OUT}`)
console.log(`[srcsets] ${Object.keys(srcsets).length} → ${SS_OUT}`)
console.log(`[dimensions] ${Object.keys(dimensions).length} → ${DIM_OUT}`)
