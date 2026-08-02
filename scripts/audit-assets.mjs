import { createHash } from "node:crypto"
import { readdir, readFile, stat } from "node:fs/promises"
import { join, relative } from "node:path"
import { spawnSync } from "node:child_process"

const PUBLIC = "public"
async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else yield path
  }
}
const files = []
for await (const path of walk(PUBLIC)) files.push(path)
const forbidden = files.filter(path => relative(PUBLIC, path).startsWith("meta-review/"))
if (forbidden.length) throw new Error(`public/meta-review contains ${forbidden.length} non-production artifact(s)`)
const trackedGenerated = spawnSync("git", ["ls-files", "public/resp"], { encoding: "utf8" }).stdout.trim()
if (trackedGenerated) throw new Error("generated public/resp files must not be tracked")
const groups = new Map()
for (const path of files) {
  if (path.includes(`${join(PUBLIC, "resp")}`)) continue
  const size = (await stat(path)).size
  if (size < 32 * 1024) continue
  const hash = createHash("sha256").update(await readFile(path)).digest("hex")
  const group = groups.get(hash) ?? []
  group.push({ path: relative(PUBLIC, path), size })
  groups.set(hash, group)
}
let duplicatedBytes = 0
for (const group of groups.values()) if (group.length > 1) duplicatedBytes += group[0].size * (group.length - 1)
console.log(`[assets] ${files.length} files; exact duplicate overhead ${(duplicatedBytes / 1024).toFixed(1)} KiB`)
if (duplicatedBytes > 1024 * 1024) throw new Error("exact duplicate public assets exceed 1 MiB budget")
