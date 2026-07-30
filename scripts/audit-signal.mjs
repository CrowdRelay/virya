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
const staffAuth = read("src/server/staffQrAuth.ts")
const staffApi = read("src/server/staffQrApi.ts")
const staffPage = read("src/pages/staff/qr.astro")
const staffManager = read("src/components/preact/staff/ConcertQrManager.tsx")
const staffOverview = read("src/pages/api/staff/qr/overview.ts")
const liveEventsServer = read("src/server/liveEvents.ts")
const liveEventsBrowser = read("src/lib/liveEvents.ts")
const liveEventCard = read("src/components/preact/LiveEventCard.tsx")
const homepageShows = read("src/components/preact/Shows.tsx")
const signalHub = read("src/components/preact/signal/SignalHub.tsx")

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
  signalCopy.includes("one global draw for three physical albums") &&
    signalCopy.includes("jednej globalnej puli trzech płyt"),
  "Signal copy must describe one global pool of three physical albums.",
)
assert(
  signalCopy.includes("Event-specific guest-list draws stay separate") &&
    signalCopy.includes("Wejściówki mają osobne pule wydarzeń"),
  "Signal copy must keep event ticket draws separate from the global album draw.",
)
assert(
  staffAuth.includes("httpOnly: true") &&
    staffAuth.includes('sameSite: "strict"') &&
    staffAuth.includes("timingSafeEqual") &&
    staffApi.includes("CROWDRELAY_ADMIN_API_KEY") &&
    !staffManager.includes("import.meta.env.CROWDRELAY_ADMIN_API_KEY") &&
    !staffManager.includes("Authorization: `Bearer"),
  "Staff QR authentication or server-only CrowdRelay proxy is incomplete.",
)
assert(
  staffPage.includes('name="robots" content="noindex, nofollow, noarchive"') &&
    staffManager.includes("#checkin=") &&
    staffManager.includes("Wyłącz ten QR"),
  "Staff QR page must remain private-indexed, fragment-based and revocable.",
)
assert(
  staffManager.includes('/api/staff/qr/overview') &&
    !staffManager.includes('Promise.all(') &&
    staffOverview.includes('admin/event-qr/overview'),
  "Staff QR must load events and campaigns through one authenticated overview request.",
)
assert(
  liveEventsBrowser.includes('fetch("/api/events"') &&
    liveEventsServer.includes("CURATED_LIVE_EVENTS") &&
    liveEventsServer.includes("Promise.allSettled"),
  "The unified live-events endpoint must retain a curated fallback and fail open.",
)
assert(
  homepageShows.includes("LiveEventCard") &&
    signalHub.includes("LiveEventCard") &&
    liveEventCard.includes("virya-live-card__orbit--outer") &&
    liveEventCard.includes("virya-live-card__orbit--inner"),
  "Homepage and Signal must share the same live-event card and orbit treatment.",
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
  "src/pages/staff/index.astro",
  "src/pages/staff/qr.astro",
  "src/pages/api/staff/qr/status.ts",
  "src/pages/api/staff/qr/login.ts",
  "src/pages/api/staff/qr/logout.ts",
  "src/pages/api/events.ts",
  "src/pages/api/staff/qr/events.ts",
  "src/pages/api/staff/qr/overview.ts",
  "src/pages/api/staff/qr/campaigns.ts",
  "src/pages/api/staff/qr/campaigns/[id].ts",
]) {
  assert(existsSync(resolve(root, path)), `Missing Signal route: ${path}`)
}

if (failures.length) {
  console.error("Virya Signal source audit failed:\n")
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log("Virya Signal source audit passed.")
