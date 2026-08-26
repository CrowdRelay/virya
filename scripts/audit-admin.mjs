import { readFileSync } from "node:fs"

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const assertions = [
  ["src/pages/staff/pair.astro", "StaffPairingManager client:load"],
  ["src/pages/staff/pair.astro", "noindex, nofollow, noarchive"],
  ["src/pages/api/staff/pairing.ts", "hasStaffQrSession"],
  ["src/pages/api/staff/pairing.ts", "isSameOriginRequest"],
  ["src/server/staffPairing.ts", "virya-signal://pair?payload="],
  ["src/server/staffPairing.ts", 'role: "staff"'],
  ["src/components/preact/staff/AdminConsole.tsx", "/api/staff/qr/login"],
  ["src/components/preact/staff/AdminTicketingTab.tsx", "/api/staff/admin/ticketing/"],
  ["src/pages/api/staff/admin/status.ts", "hasStaffQrSession"],
  ["src/pages/api/staff/admin/overview.ts", "hasStaffQrSession"],
  ["src/pages/api/staff/admin/overview.ts", "Promise.allSettled"],
  ["src/pages/api/staff/admin/overview.ts", "unavailableSources"],
  ["src/pages/api/staff/admin/signal/overview.ts", "admin/signal/overview"],
  ["src/pages/api/staff/admin/signal/overview.ts", "hasStaffQrSession"],
  ["src/components/preact/staff/AdminConsoleTabs.tsx", "function SignalTab()"],
  ["src/components/preact/staff/AdminConsoleTabs.tsx", "dane wyłącznie zagregowane"],
  ["src/components/preact/staff/AdminConsoleTabs.tsx", "BackendLoader"],
  ["src/components/preact/staff/AdminConsoleTabs.tsx", "aria-busy"],
  ["src/components/preact/staff/ConcertQrManager.tsx", "Pobieram koncerty, kampanie QR i bramkę"],
  ["src/components/preact/staff/AccountingManager.tsx", "Pobieram sprzedaż, Stripe i księgowość"],
  ["src/components/preact/staff/StaffCommerceManager.tsx", "Pobieram merch, magazyn i losowania"],
  ["src/components/preact/staff/StaffCommerceManager.tsx", "USUŃ BŁĘDNE LOSOWANIE"],
  ["src/pages/api/staff/commerce/draws/[id]/delete.ts", "isSameOriginRequest"],
  ["src/pages/api/staff/commerce/draws/[id]/delete.ts", "admin/reward-draws/"],
  ["src/components/preact/staff/AdminConsoleTabs.tsx", "Część danych jest chwilowo niedostępna"],
  ["src/pages/api/staff/admin/ticketing/[slug].ts", "isSameOriginRequest"],
  ["src/pages/api/staff/admin/ticketing/[slug].ts", "2_100"],
  ["src/pages/api/staff/admin/ticketing/[slug].ts", "refreshPending"],
  ["src/pages/api/staff/admin/admission/issue.ts", "isSameOriginRequest"],
  ["src/pages/api/staff/admin/admission/revoke.ts", "isSameOriginRequest"],
  ["src/pages/api/staff/admin/mailer/test.ts", "isSameOriginRequest"],
]

for (const [path, needle] of assertions) {
  const source = read(path)
  if (!source.includes(needle)) throw new Error(`${path} is missing ${needle}`)
}

const client = [
  "src/components/preact/staff/AdminConsole.tsx",
  "src/components/preact/staff/AdminConsoleTabs.tsx",
  "src/components/preact/staff/AdminTicketingTab.tsx",
  "src/components/preact/staff/adminConsoleShared.ts",
].map(read).join("\n")
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
