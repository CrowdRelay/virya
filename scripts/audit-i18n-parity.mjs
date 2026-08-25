#!/usr/bin/env node
// Route-parity gate: every public English page must have its Polish mirror
// under /pl and vice versa. Layout's language redirect sends pl-preferring
// browsers from any lang="en" route to /pl<pathname>, so an EN-only route is
// a guaranteed 404 for part of the audience — this turns that invariant into
// a build-time failure instead of a runtime surprise.
import { readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const pagesDir = join(root, "src", "pages")

// Documented, deliberate asymmetries:
//  - 404: framework error page, rendered for both locales from one template.
//  - dowody: Polish-language evidence/drawings section, no EN surface yet.
const EN_WITHOUT_PL = new Set(["404.astro"])
const PL_PREFIXES_WITHOUT_EN = ["dowody"]

const walk = (dir, base, skip) => {
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skip?.includes(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...walk(full, base, skip))
    else if (entry.name.endsWith(".astro")) found.push(relative(base, full))
  }
  return found
}

const enRoutes = walk(pagesDir, pagesDir, ["api", "staff", "pl"])
const plRoutes = walk(join(pagesDir, "pl"), join(pagesDir, "pl"))

const problems = []
for (const route of enRoutes) {
  if (EN_WITHOUT_PL.has(route)) continue
  if (!plRoutes.includes(route)) {
    problems.push(`EN route without PL mirror: src/pages/${route}`)
  }
}
for (const route of plRoutes) {
  if (PL_PREFIXES_WITHOUT_EN.some(prefix => route.startsWith(prefix))) continue
  if (!enRoutes.includes(route)) {
    problems.push(`PL route without EN mirror: src/pages/pl/${route}`)
  }
}

if (problems.length > 0) {
  console.error("i18n route parity broken:\n" + problems.map(p => `  - ${p}`).join("\n"))
  console.error("\nAdd the missing mirror page or extend the exemption lists in scripts/audit-i18n-parity.mjs.")
  process.exit(1)
}
console.log(`i18n parity ok: ${enRoutes.filter(r => !EN_WITHOUT_PL.has(r)).length} public EN routes mirrored (${plRoutes.length} PL pages).`)
