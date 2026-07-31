import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = process.cwd()
const read = path => readFileSync(resolve(root, path), "utf8")
const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const types = read("src/lib/crowdrelay-client.ts")
const server = read("src/server/liveEvents.ts")
const browser = read("src/lib/liveEvents.ts")
const card = read("src/components/preact/LiveEventCard.tsx")
const detailPage = read("src/components/SignalEventPage.astro")
const detail = read("src/components/preact/signal/EventDetail.tsx")
const checkout = read("src/components/preact/tickets/TicketCheckout.tsx")
const inventory = read("src/lib/ticketInventory.ts")
const inventoryBar = read("src/components/preact/tickets/TicketInventoryBar.tsx")
const navbar = read("src/components/Navbar.astro")
const legacyEn = read("src/pages/shows/[slug].astro")
const legacyPl = read("src/pages/pl/shows/[slug].astro")

assert(
  types.includes("export interface TicketSaleSummary") &&
    types.includes("sold: number") &&
    types.includes("reserved: number") &&
    types.includes("ticket_sale?: TicketSaleSummary | null"),
  "Public event DTO must expose the first-party ticket summary.",
)
assert(
  server.includes("enrichEventsWithTicketSales") &&
    server.includes("pendingTicketSales") &&
    server.includes("MAX_TICKET_SALE_CACHE_ENTRIES"),
  "Server event loading must enrich ticket state through bounded, coalesced caching.",
)
assert(
  browser.includes("isTicketSaleSummary") &&
    browser.includes("value.ticket_sale"),
  "Browser event validation must retain ticket-sale summaries.",
)
assert(
  inventory.includes("normalizeTicketInventory") &&
    inventory.includes("sold + reserved + available = capacity") &&
    inventoryBar.includes("Payment in progress"),
  "Ticket inventory must normalize staggered deployments and distinguish active payment holds.",
)
assert(
  card.includes("firstPartyTicketHref") &&
    card.includes('`${details}#tickets`') &&
    card.includes("from_price_gross_minor"),
  "Live cards must surface first-party ticket availability and link to checkout.",
)
assert(
  detailPage.includes("initialTicketSale={ticketSale}") &&
    detailPage.includes("initialSale={ticketSale}"),
  "Gig SSR must pass one ticket offer into both the hero and checkout island.",
)
assert(
  detail.includes('href="#tickets"') &&
    detail.includes("ticketStateLabel") &&
    detail.includes("virya-event-facts") &&
    detail.includes("hidden border-t border-zinc-800 pt-6 sm:block") &&
    detail.includes("virya-prose"),
  "Gig detail must expose the ticket CTA and coherent live facts.",
)
assert(
  checkout.includes("initialSale?: TicketSaleOffer | null") &&
    checkout.includes("virya-ticket-stepper") &&
    checkout.includes("TicketInventoryBar") &&
    checkout.includes("Payment in progress") &&
    checkout.includes("Secure Stripe payment"),
  "Ticket checkout must SSR the known sale and keep an accessible quantity control.",
)
assert(
  legacyEn.includes("Astro.redirect(`/live/") &&
    legacyPl.includes("Astro.redirect(`/pl/live/"),
  "Legacy Bandsintown detail routes must converge on the unified gig view.",
)
assert(
  navbar.includes("__viryaNavController?.abort()") &&
    navbar.includes("observer.disconnect()") &&
    navbar.includes("{ passive: true, signal }"),
  "Astro navigation must release global listeners and observers on page swaps.",
)

if (failures.length) {
  console.error("Virya live/ticketing audit failed:\n")
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log("Virya live/ticketing audit passed.")
