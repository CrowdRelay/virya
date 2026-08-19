import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const src = path.join(root, "src")
const files = []
const walk = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(astro|ts|js)$/.test(entry.name)) files.push(full)
  }
}
walk(src)
const failures = []
for (const file of files) {
  const text = fs.readFileSync(file, "utf8")
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('type="application/ld+json"') || !line.includes('set:html=')) continue
    if (line.includes('serializeJsonLd(') || line.includes('serializeViryaIdentity()') || line.includes('.replace(/</g')) continue
    failures.push(`${path.relative(root, file)}: unsafe JSON-LD serializer: ${line.trim()}`)
  }
}
const seo = fs.readFileSync(path.join(src, "utils/seo.js"), "utf8")
if (!seo.includes('.replace(/</g')) failures.push('src/utils/seo.js must escape < in embedded JSON-LD')
if (failures.length) { console.error(failures.join("\n")); process.exit(1) }
console.log(`VIRYA_JSON_LD=PASS files=${files.length} escaping=script-safe`)
