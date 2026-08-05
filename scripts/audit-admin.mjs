import { readFileSync } from "node:fs"

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const assertions = [
  ["src/pages/staff/control.astro", "noindex, nofollow, noarchive"],
  ["src/pages/staff/control.astro", "AdminConsole client:load"],
  ["src/pages/staff/pair.astro", "StaffPairingManager client:load"],
  ["src/pages/staff/pair.astro", "noindex, nofollow, noarchive"],
  ["src/pages/api/staff/pairing.ts", "hasStaffQrSession"],
  ["src/pages/api/staff/pairing.ts", "isSameOriginRequest"],
  ["src/server/staffPairing.ts", "virya-signal://pair?payload="],
  ["src/server/staffPairing.ts", 'role: "staff"'],
  ["src/components/preact/staff/AdminConsole.tsx", "/api/staff/qr/login"],
  ["src/components/preact/staff/AdminConsole.tsx", "/api/staff/admin/ticketing/"],
  ["src/pages/api/staff/admin/status.ts", "hasStaffQrSession"],
  ["src/pages/api/staff/admin/overview.ts", "hasStaffQrSession"],
  ["src/pages/api/staff/admin/overview.ts", "Promise.allSettled"],
  ["src/pages/api/staff/admin/overview.ts", "unavailableSources"],
  ["src/pages/api/staff/admin/signal/overview.ts", "admin/signal/overview"],
  ["src/pages/api/staff/admin/signal/overview.ts", "hasStaffQrSession"],
  ["src/components/preact/staff/AdminConsole.tsx", "function SignalTab()"],
  ["src/components/preact/staff/AdminConsole.tsx", "dane wyłącznie zagregowane"],
  ["src/components/preact/staff/AdminConsole.tsx", "trybie częściowym"],
  ["src/pages/api/staff/admin/ticketing/[slug].ts", "isSameOriginRequest"],
  ["src/pages/api/staff/admin/ticketing/[slug].ts", "2_100"],
  ["src/pages/api/staff/admin/ticketing/[slug].ts", "refreshPending"],
  ["src/pages/api/staff/admin/admission/issue.ts", "isSameOriginRequest"],
  ["src/pages/api/staff/admin/admission/revoke.ts", "isSameOriginRequest"],
  ["src/pages/api/staff/admin/mailer/test.ts", "isSameOriginRequest"],
  ["src/components/preact/staff/EcosystemControl.tsx", "External proofs"],
  ["src/components/preact/staff/EcosystemControl.tsx", "external_proof_anchoring_enabled"],
  ["src/components/preact/staff/EcosystemControl.tsx", "Promise.allSettled"],
  ["src/pages/api/staff/admin/ecosystem/emit-due.ts", "isSameOriginRequest"],
  ["src/pages/api/staff/admin/ecosystem/reconcile.ts", "isSameOriginRequest"],
  ["src/pages/api/staff/admin/ecosystem/flags/[key].ts", "isSameOriginRequest"],
  ["src/pages/api/staff/admin/ecosystem/checklists/[slug]/[item].ts", "isSameOriginRequest"],
  ["src/pages/api/staff/admin/ecosystem/proofs.ts", "admin/proofs/batches"],
  ["src/pages/api/staff/admin/ecosystem/proofs/audit.ts", "admin/proofs/audit-batches"],
  ["src/pages/api/staff/admin/ecosystem/proofs/audit.ts", "isSameOriginRequest"],
]

for (const [path, needle] of assertions) {
  const source = read(path)
  if (!source.includes(needle)) throw new Error(`${path} is missing ${needle}`)
}

const client = read("src/components/preact/staff/AdminConsole.tsx")
for (const needle of [
  "checkout_created_orders",
  "reserved_tickets",
  "W trakcie płatności",
  "TicketInventoryBar",
  "validateTicketForm",
]) {
  if (!client.includes(needle)) {
    throw new Error(`Admin ticketing UI is missing ${needle}`)
  }
}
for (const secret of [
  "CROWDRELAY_ADMIN_API_KEY",
  "CROWDRELAY_COMMERCE_API_KEY",
  "GMAIL_APP_PASSWORD",
  "STRIPE_SECRET_KEY",
]) {
  if (client.includes(secret)) throw new Error(`Browser bundle references secret ${secret}`)
}

const pairingClient = read("src/components/preact/staff/StaffPairingManager.tsx")
for (const secret of ["STAFF_OPERATOR_KEY", "CROWDRELAY_ADMIN_API_KEY"]) {
  if (pairingClient.includes(secret)) {
    throw new Error(`Pairing browser bundle references secret ${secret}`)
  }
}
for (const unsafeExport of ["navigator.clipboard", "downloadSvg", "POBIERZ SVG"]) {
  if (pairingClient.includes(unsafeExport)) {
    throw new Error(`Pairing UI exposes portable credential material: ${unsafeExport}`)
  }
}

console.log("Admin control center audit passed")
