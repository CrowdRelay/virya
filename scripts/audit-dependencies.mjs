#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import process from "node:process"

const ROOT = resolve(import.meta.dirname, "..")
const argv = process.argv.slice(2)
const inputFlag = argv.indexOf("--input")
const inputPath = inputFlag >= 0 ? argv[inputFlag + 1] : null
if (inputFlag >= 0 && !inputPath) throw new Error("--input requires a path")

const policy = JSON.parse(readFileSync(resolve(ROOT, "security/npm-audit-allowlist.json"), "utf8"))
const lock = JSON.parse(readFileSync(resolve(ROOT, "package-lock.json"), "utf8"))
const today = new Date().toISOString().slice(0, 10)

function parseVersion(version) {
  const match = String(version ?? "").match(/^(\d+)\.(\d+)\.(\d+)/)
  return match ? match.slice(1).map(Number) : null
}

for (const [packagePath, meta] of Object.entries(lock.packages ?? {})) {
  if (!(packagePath === "node_modules/sharp" || packagePath.endsWith("/node_modules/sharp"))) continue
  const version = parseVersion(meta?.version)
  if (!version || version[0] !== 0 || version[1] < 35) {
    console.error(`DEPENDENCY_AUDIT=FAIL reason=vulnerable-sharp-lock path=${packagePath} version=${meta?.version ?? "missing"}`)
    process.exit(1)
  }
}
if (typeof policy.expiresOn !== "string" || today > policy.expiresOn) {
  console.error(`DEPENDENCY_AUDIT=FAIL reason=allowlist-expired expires=${policy.expiresOn ?? "missing"}`)
  process.exit(1)
}

const sourceFiles = ["src", "scripts", "tests"]
const directImportNeedles = ["image-size", "extract-zip"]
for (const needle of directImportNeedles) {
  const scan = spawnSync("grep", ["-R", "-n", "--include=*.ts", "--include=*.tsx", "--include=*.js", "--include=*.mjs", `from [\\\"']${needle}[\\\"']\\|require([\\\"']${needle}[\\\"']`, ...sourceFiles], {
    cwd: ROOT,
    encoding: "utf8",
  })
  if (scan.status === 0) {
    console.error(`DEPENDENCY_AUDIT=FAIL reason=direct-import-forbidden package=${needle}`)
    console.error(scan.stdout.trim())
    process.exit(1)
  }
  if (scan.status !== 1) {
    const detail = scan.error?.message ?? scan.stderr?.trim() ?? `grep-status-${scan.status ?? "spawn"}`
    console.error(`DEPENDENCY_AUDIT=FAIL reason=source-scan-error package=${needle} error=${detail}`)
    process.exit(1)
  }
}

for (const entry of policy.entries ?? []) {
  const version = lock.packages?.[`node_modules/${entry.package}`]?.version
  if (version !== entry.version) {
    console.error(`DEPENDENCY_AUDIT=FAIL reason=allowlist-version-drift package=${entry.package} expected=${entry.version} actual=${version ?? "missing"}`)
    process.exit(1)
  }
}

let report
if (inputPath) {
  report = JSON.parse(readFileSync(resolve(process.cwd(), inputPath), "utf8"))
} else {
  const audit = spawnSync("npm", ["audit", "--json"], { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })
  if (!audit.stdout?.trim()) {
    console.error(`DEPENDENCY_AUDIT=FAIL reason=npm-audit-unavailable status=${audit.status ?? "spawn"}`)
    if (audit.stderr) console.error(audit.stderr.trim())
    process.exit(1)
  }
  try {
    report = JSON.parse(audit.stdout)
  } catch {
    console.error("DEPENDENCY_AUDIT=FAIL reason=invalid-npm-audit-json")
    if (audit.stderr) console.error(audit.stderr.trim())
    process.exit(1)
  }
}

const vulnerabilities = report.vulnerabilities ?? {}
const allowed = new Set((policy.entries ?? []).map((entry) => `${entry.package}:${String(entry.advisory).toUpperCase()}`))
const memo = new Map()

function advisoryId(url) {
  const match = String(url ?? "").match(/GHSA-[0-9a-z-]+/i)
  return match?.[0]?.toUpperCase() ?? null
}

function leafAdvisories(name, stack = new Set()) {
  if (memo.has(name)) return memo.get(name)
  if (stack.has(name)) return [{ package: name, advisory: null, reason: "cycle" }]
  const item = vulnerabilities[name]
  if (!item) return [{ package: name, advisory: null, reason: "missing-via-node" }]
  const nextStack = new Set(stack).add(name)
  const leaves = []
  for (const via of item.via ?? []) {
    if (typeof via === "string") {
      leaves.push(...leafAdvisories(via, nextStack))
    } else if (via && typeof via === "object") {
      leaves.push({ package: via.name ?? name, advisory: advisoryId(via.url), reason: via.title ?? "advisory" })
    }
  }
  if (leaves.length === 0) leaves.push({ package: name, advisory: null, reason: "no-advisory-leaf" })
  memo.set(name, leaves)
  return leaves
}

const blockers = []
const waived = []
for (const [name, item] of Object.entries(vulnerabilities)) {
  if (!['high', 'critical'].includes(String(item.severity).toLowerCase())) continue
  const leaves = leafAdvisories(name)
  const unapproved = leaves.filter((leaf) => !leaf.advisory || !allowed.has(`${leaf.package}:${leaf.advisory}`))
  if (unapproved.length) blockers.push({ name, severity: item.severity, leaves: unapproved })
  else waived.push({ name, severity: item.severity, leaves })
}

if (blockers.length) {
  for (const blocker of blockers) {
    const detail = blocker.leaves.map((leaf) => `${leaf.package}:${leaf.advisory ?? "unknown"}`).join(",")
    console.error(`DEPENDENCY_AUDIT=FAIL package=${blocker.name} severity=${blocker.severity} advisory=${detail}`)
  }
  process.exit(1)
}

console.log(`DEPENDENCY_AUDIT=PASS high_critical_waived=${waived.length} allowlist_expires=${policy.expiresOn}`)
