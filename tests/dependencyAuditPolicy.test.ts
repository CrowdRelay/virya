import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const root = new URL("..", import.meta.url).pathname
const script = join(root, "scripts/audit-dependencies.mjs")

function run(report: object) {
  const dir = mkdtempSync(join(tmpdir(), "virya-audit-"))
  const path = join(dir, "audit.json")
  writeFileSync(path, JSON.stringify(report))
  return spawnSync(process.execPath, [script, "--input", path], { cwd: root, encoding: "utf8" })
}

test("controlled dependency audit accepts only the pinned no-fix Netlify advisory leaves", () => {
  const result = run({
    vulnerabilities: {
      "image-size": {
        severity: "high",
        via: [
          { name: "image-size", url: "https://github.com/advisories/GHSA-5p2g-fcmc-qvqq" },
          { name: "image-size", url: "https://github.com/advisories/GHSA-w3rx-r6r6-pgpr" },
        ],
      },
      "@netlify/dev-utils": { severity: "high", via: ["image-size"] },
      "extract-zip": {
        severity: "high",
        via: [{ name: "extract-zip", url: "https://github.com/advisories/GHSA-jmr9-qjv8-65gv" }],
      },
      "@netlify/functions-dev": { severity: "high", via: ["extract-zip"] },
    },
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /DEPENDENCY_AUDIT=PASS/)
})

test("controlled dependency audit fails closed on a new high advisory", () => {
  const result = run({
    vulnerabilities: {
      "surprise-package": {
        severity: "high",
        via: [{ name: "surprise-package", url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc" }],
      },
    },
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /DEPENDENCY_AUDIT=FAIL/)
})

test("locked Netlify image chain cannot reintroduce a pre-0.35 sharp", () => {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
  const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"))
  assert.equal(packageJson.overrides?.ipx?.sharp, "0.35.3")
  const sharpCopies = Object.entries(lock.packages ?? {})
    .filter(([path]) => path === "node_modules/sharp" || path.endsWith("/node_modules/sharp"))
    .map(([path, meta]: [string, any]) => [path, meta.version] as const)
  assert.ok(sharpCopies.length > 0)
  for (const [path, version] of sharpCopies) {
    const [major, minor] = String(version).split(".").map(Number)
    assert.ok(major > 0 || minor >= 35, `${path} is still vulnerable at ${version}`)
  }
})
