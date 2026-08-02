import { readdir, stat } from "node:fs/promises"
import { extname, join, relative } from "node:path"
const root = process.argv[2] ?? "dist"
async function* walk(dir) { for (const entry of await readdir(dir, { withFileTypes: true })) { const path=join(dir,entry.name); if(entry.isDirectory()) yield* walk(path); else yield path } }
const files=[]
for await (const path of walk(root)) files.push({ path, size:(await stat(path)).size })
const code = files.filter(({path}) => [".js", ".mjs", ".css", ".wasm"].includes(extname(path)))
const total = code.reduce((sum,file)=>sum+file.size,0)
const largest = [...code].sort((a,b)=>b.size-a.size).slice(0,10)
console.log(`[build-budget] code ${(total/1024).toFixed(1)} KiB across ${code.length} files`)
for (const file of largest) console.log(`${(file.size/1024).toFixed(1).padStart(8)} KiB  ${relative(root,file.path)}`)
const maxTotal = Number(process.env.VIRYA_MAX_CODE_KIB ?? 4096) * 1024
const maxChunk = Number(process.env.VIRYA_MAX_CHUNK_KIB ?? 1024) * 1024
if (total > maxTotal) throw new Error(`code assets exceed ${maxTotal/1024} KiB`)
if (largest[0]?.size > maxChunk) throw new Error(`largest code asset exceeds ${maxChunk/1024} KiB`)
