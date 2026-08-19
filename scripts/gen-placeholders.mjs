import sharp from "sharp"
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { readdir, readFile, writeFile, mkdir, rm, rename, stat } from "node:fs/promises"
import { join, relative, extname, basename, dirname } from "node:path"

const PUBLIC = "public"
const RESP_DIR = join(PUBLIC, "resp")
const CACHE_DIR = join(".cache", "virya-images")
const MANIFEST = join(CACHE_DIR, "manifest-v2.json")
const PH_OUT = "src/placeholders.json"
const SS_OUT = "src/srcsets.json"
const DIM_OUT = "src/imageDimensions.json"
const EXTS = new Set([".webp", ".jpg", ".jpeg", ".png", ".avif"])
const WIDTHS = [400, 800, 1200, 1600]
const COVER_WIDTHS = [400, 680, 800, 1200, 1600]
const MIN_RESPONSIVE = 200
const CONCURRENCY = Math.max(1, Math.min(4, Number(process.env.IMAGE_JOBS) || 4))
const CONFIG_VERSION = "v2:webp80:lqip40:24px"

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (path === RESP_DIR || path === join(PUBLIC, "meta-review")) continue
      yield* walk(path)
    } else yield path
  }
}
const loadJson = async (path, fallback) => { try { return JSON.parse(await readFile(path, "utf8")) } catch { return fallback } }
const atomicJson = async (path, value) => { const temp=`${path}.tmp-${process.pid}`; await writeFile(temp, JSON.stringify(value)); await rename(temp,path) }
const exists = async path => { try { return (await stat(path)).isFile() } catch { return false } }
const fingerprint = async file => {
  const hash = createHash("sha256").update(CONFIG_VERSION)
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest("hex")
}
const stable = record => Object.fromEntries(Object.keys(record).sort().map(key => [key, record[key]]))

await mkdir("src", { recursive: true })
await mkdir(RESP_DIR, { recursive: true })
await mkdir(CACHE_DIR, { recursive: true })
const old = await loadJson(MANIFEST, { entries: {} })
const entries = {}
const placeholders = {}
const srcsets = {}
const dimensions = {}
const files=[]
for await (const file of walk(PUBLIC)) if (EXTS.has(extname(file).toLowerCase())) files.push(file)
let hits=0, misses=0, next=0

async function processImage(file) {
  const key = "/" + relative(PUBLIC, file).split(/[\\/]/).join("/")
  const hash = await fingerprint(file)
  const cached = old.entries?.[key]
  const nativeWFromCache = Number(cached?.dimensions?.w || 0)
  const desiredWidths = (key.startsWith("/covers/") ? COVER_WIDTHS : WIDTHS).filter(width => width < nativeWFromCache)
  const cachedHasDesiredWidths = desiredWidths.every(width => cached?.srcset?.includes(`-${width}w.webp ${width}w`))
  if (cached?.fingerprint === hash && cached.placeholder && cached.dimensions && cachedHasDesiredWidths && await Promise.all((cached.outputs ?? []).map(exists)).then(values => values.every(Boolean))) {
    entries[key]=cached; placeholders[key]=cached.placeholder; dimensions[key]=cached.dimensions
    if (cached.srcset) srcsets[key]=cached.srcset
    hits++; return
  }
  misses++
  for (const output of cached?.outputs ?? []) await rm(output, { force:true })
  const meta = await sharp(file).metadata()
  const nativeW = meta.width || 0
  const outputs=[]
  const placeholder = (await sharp(file).resize(24,24,{fit:"inside"}).blur(8).webp({quality:40}).toBuffer()).toString("base64")
  let srcset
  if (nativeW >= MIN_RESPONSIVE) {
    const rel = relative(PUBLIC,file).split(/[\\/]/).join("/")
    const relDir=dirname(rel), base=basename(rel,extname(rel)), outDir=relDir==="."?RESP_DIR:join(RESP_DIR,relDir)
    await mkdir(outDir,{recursive:true})
    const prefix=relDir==="."?`/resp/${base}`:`/resp/${relDir}/${base}`
    const parts=[]
    const responsiveWidths = key.startsWith("/covers/") ? COVER_WIDTHS : WIDTHS
    for (const width of responsiveWidths) if (width < nativeW) {
      const output=join(outDir,`${base}-${width}w.webp`); outputs.push(output)
      await sharp(file).resize(width,null,{withoutEnlargement:true}).webp({quality:80}).toFile(output)
      parts.push(`${prefix}-${width}w.webp ${width}w`)
    }
    if (parts.length) { parts.push(`${key} ${nativeW}w`); srcset=parts.join(", ") }
  }
  const entry={ fingerprint:hash, placeholder:`data:image/webp;base64,${placeholder}`, dimensions:{w:meta.width||0,h:meta.height||0}, srcset, outputs }
  entries[key]=entry; placeholders[key]=entry.placeholder; dimensions[key]=entry.dimensions; if(srcset) srcsets[key]=srcset
}
async function worker(){ while(next<files.length){ const file=files[next++]; await processImage(file) } }
await Promise.all(Array.from({length:Math.min(CONCURRENCY,files.length)},worker))
for (const [key, entry] of Object.entries(old.entries ?? {})) if (!entries[key]) for (const output of entry.outputs ?? []) await rm(output,{force:true})
await atomicJson(PH_OUT,stable(placeholders)); await atomicJson(SS_OUT,stable(srcsets)); await atomicJson(DIM_OUT,stable(dimensions)); await atomicJson(MANIFEST,{version:2,entries:stable(entries)})
console.log(`[images] ${files.length} source images; cache hits=${hits}; processed=${misses}`)
