import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"
import { readServerEnv } from "../src/server/runtimeEnv.ts"

const ROOT = new URL("../", import.meta.url)
const SERVER_RUNTIME_ENV_NAMES = [
  "AREA_AUTH_SECRET",
  "AREA_CHALLENGE_SECRET",
  "AREA_TICKET_REWARDS_JSON",
  "BANDSINTOWN_APP_ID",
  "CROWDRELAY_ADMIN_API_KEY",
  "CROWDRELAY_COMMERCE_API_KEY",
  "CROWDRELAY_MAILER_API_KEY",
  "CROWDRELAY_WEBHOOK_SECRET",
  "GMAIL_APP_PASSWORD",
  "INPOST_ORGANIZATION_ID",
  "INPOST_SHIPX_TOKEN",
  "MAIL_PROVIDER",
  "PUBLIC_CROWDRELAY_API_URL",
  "RESEND_API_KEY",
  "SIGNAL_FEEDBACK_RATE_SECRET",
  "SIGNAL_MAIL_FROM",
  "SIGNAL_MAIL_REPLY_TO",
  "STAFF_QR_PASSWORD_SHA256",
  "STAFF_QR_SESSION_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "VIRYA_TICKET_MAILER_API_KEY",
] as const

const serverRoots = ["src/server", "src/pages/api", "src/utils"]

const sourceFiles = (root: string): string[] => {
  const absolute = new URL(root, ROOT).pathname
  const result: string[] = []
  const visit = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name)
      const stat = statSync(path)
      if (stat.isDirectory()) visit(path)
      else if (/\.(?:[cm]?[jt]sx?|astro)$/.test(name)) result.push(path)
    }
  }
  visit(absolute)
  return result
}

test("server-only configuration prefers Netlify runtime environment", () => {
  const violations: string[] = []
  for (const root of serverRoots) {
    for (const path of sourceFiles(root)) {
      const source = readFileSync(path, "utf8")
      for (const name of SERVER_RUNTIME_ENV_NAMES) {
        const direct = `import.meta.env.${name}`
        let offset = source.indexOf(direct)
        while (offset >= 0) {
          const prefix = source.slice(Math.max(0, offset - 80), offset)
          if (!/readServerEnv\([^)]*$/.test(prefix)) {
            violations.push(`${relative(new URL(".", ROOT).pathname, path)}: ${name}`)
          }
          offset = source.indexOf(direct, offset + direct.length)
        }
      }
    }
  }
  assert.deepEqual(violations, [])
})


test("readServerEnv prefers runtime values and preserves local fallback", () => {
  const name = "VIRYA_RUNTIME_ENV_CONTRACT"
  const previous = process.env[name]
  try {
    process.env[name] = " runtime "
    assert.equal(readServerEnv(name, "build"), "runtime")
    process.env[name] = "   "
    assert.equal(readServerEnv(name, " build "), "build")
    delete process.env[name]
    assert.equal(readServerEnv(name), undefined)
  } finally {
    if (previous === undefined) delete process.env[name]
    else process.env[name] = previous
  }
})
