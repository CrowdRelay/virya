import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = process.cwd()
const read = path => readFileSync(resolve(root, path), "utf8")
const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const layout = read("src/components/Layout.astro")
const signalPage = read("src/components/SignalPage.astro")
const accountPage = read("src/components/SignalAccountPage.astro")
const actionPage = read("src/components/SignalActionPage.astro")
const area = read("src/components/AreaExperience.astro")
const client = read("src/lib/crowdrelay.ts")
const browserClient = read("src/lib/crowdrelay-client.ts")
const headers = read("public/_headers")
const redirects = read("public/_redirects")
const envExample = read(".env.example")
const signalCopy = read("src/data/signalCopy.ts")
const webhook = read("src/pages/api/crowdrelay-webhook.ts")
const subscribe = read("src/pages/api/subscribe.ts")

assert(
  !layout.includes("crowdrelay") && !layout.includes("SignalHub"),
  "CrowdRelay must not be imported by the global layout.",
)
assert(
  signalPage.includes("<SignalHub client:visible"),
  "The Signal hub must hydrate only when its section approaches the viewport.",
)
assert(
  accountPage.includes("client:load") && actionPage.includes("client:load"),
  "Private/token pages must hydrate only on their dedicated routes.",
)
assert(
  headers.includes("connect-src 'self'") &&
    headers.includes("https://signal-api.virya.music"),
  "CSP must allow the public CrowdRelay API.",
)
assert(
  redirects.includes("/go/*") && redirects.includes("/r/*"),
  "Branded CrowdRelay redirect routes are missing.",
)
assert(
  envExample.includes("PUBLIC_CROWDRELAY_API_URL=https://signal-api.virya.music/v1/"),
  "The public CrowdRelay URL is missing from .env.example.",
)
assert(
  !envExample.match(/PUBLIC_.*(?:ADMIN|STAFF|COMMERCE|SECRET|DATABASE)/i),
  "A privileged CrowdRelay value appears in a PUBLIC_* variable.",
)
assert(
  !browserClient.match(/adminApiKey\s*[:=]\s*["'][^"']+/i) &&
    !browserClient.match(/staffApiKey\s*[:=]\s*["'][^"']+/i),
  "The browser client contains a hard-coded privileged key.",
)
assert(
  area.includes("virya-signal-city") && area.includes('signalUrl.searchParams.set("source", "area")'),
  "AREA must pass a coarse city signal into the Virya Signal bridge.",
)
assert(
  area.includes("catch") || area.includes("try"),
  "AREA bridge storage must fail open.",
)
assert(
  client.includes("timeoutMs: 2_500") && client.includes("bestEffort"),
  "CrowdRelay calls need bounded timeouts and best-effort telemetry.",
)
assert(
  (signalCopy.match(/\bareaBridge\s*:/g) ?? []).length === 3,
  "Signal copy must define the AREA bridge contract plus EN and PL translations.",
)

assert(
  envExample.includes("CROWDRELAY_WEBHOOK_SECRET=") &&
    webhook.includes("fan.confirmation_requested") &&
    webhook.includes("timingSafeEqual") &&
    webhook.includes("getSiteMailer"),
  "Signed CrowdRelay confirmation delivery ingress is incomplete.",
)
assert(
  subscribe.includes('return json({ error: "Delivery unavailable" }, 503)'),
  "Newsletter must fail closed when the mailer is unavailable.",
)
assert(
  signalCopy.includes("physical Virya albums") && signalCopy.includes("fizycznych albumów"),
  "Signal copy must describe separate physical-album concert pools.",
)

for (const path of [
  "src/pages/signal.astro",
  "src/pages/pl/signal.astro",
  "src/pages/join.astro",
  "src/pages/pl/join.astro",
  "src/pages/my-signal.astro",
  "src/pages/pl/my-signal.astro",
  "src/pages/live/[slug].astro",
  "src/pages/pl/live/[slug].astro",
  "src/pages/signal/confirm.astro",
  "src/pages/pl/signal/confirm.astro",
  "src/pages/signal/unsubscribe.astro",
  "src/pages/pl/signal/unsubscribe.astro",
]) {
  assert(existsSync(resolve(root, path)), `Missing Signal route: ${path}`)
}

if (failures.length) {
  console.error("Virya Signal source audit failed:\n")
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log("Virya Signal source audit passed.")
