import { readFileSync } from "node:fs"

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const assertions = [
  ["src/pages/staff/control.astro", "noindex, nofollow, noarchive"],
  ["src/pages/staff/control.astro", "AdminConsole client:load"],
  ["src/components/preact/staff/AdminConsole.tsx", "/api/staff/qr/login"],
  ["src/components/preact/staff/AdminConsole.tsx", "/api/staff/admin/ticketing/"],
  ["src/pages/api/staff/admin/status.ts", "hasStaffQrSession"],
  ["src/pages/api/staff/admin/overview.ts", "hasStaffQrSession"],
  ["src/pages/api/staff/admin/ticketing/[slug].ts", "isSameOriginRequest"],
  ["src/pages/api/staff/admin/admission/issue.ts", "isSameOriginRequest"],
  ["src/pages/api/staff/admin/admission/revoke.ts", "isSameOriginRequest"],
  ["src/pages/api/staff/admin/mailer/test.ts", "isSameOriginRequest"],
]

for (const [path, needle] of assertions) {
  const source = read(path)
  if (!source.includes(needle)) throw new Error(`${path} is missing ${needle}`)
}

const client = read("src/components/preact/staff/AdminConsole.tsx")
for (const secret of [
  "CROWDRELAY_ADMIN_API_KEY",
  "CROWDRELAY_COMMERCE_API_KEY",
  "GMAIL_APP_PASSWORD",
  "STRIPE_SECRET_KEY",
]) {
  if (client.includes(secret)) throw new Error(`Browser bundle references secret ${secret}`)
}

console.log("Admin control center audit passed")
