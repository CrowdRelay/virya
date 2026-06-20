const path = require("path")
const releases = require("./src/components/portfolio/items.json")

const slugify = s =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

const normalizeEvent = event => {
  if (!event) return null
  const lineup = Array.isArray(event.lineup) ? event.lineup.join(", ") : ""
  const venue = event.venue
    ? `${event.venue.name ?? ""}, ${event.venue.city ?? ""}`
    : ""
  return {
    id: event.id != null ? String(event.id) : null,
    title: lineup && venue ? `${lineup} | ${venue}` : lineup || venue || "Show",
    date: event.datetime || event.starts_at,
    event: event.url || null,
    tickets:
      event.offers?.find(o => o?.type === "Tickets")?.url ??
      event.offers?.[0]?.url ??
      null,
    venueName: event.venue?.name ?? null,
    city: [event.venue?.city, event.venue?.country].filter(Boolean).join(", "),
    lineup: Array.isArray(event.lineup) ? event.lineup : [],
    description: event.description || "",
    image: event.artist?.image_url || null,
  }
}

// Stable, unique per-event slug derived from the BandsInTown event id so the
// client list and the build-time pages always agree (no index drift → no 404).
const gigSlug = gig => `gig-${gig.id}`

const fetchGigs = async () => {
  const appId = process.env.BANDSINTOWN_APP_ID
  if (!appId) {
    console.warn(
      "[bandsintown] BANDSINTOWN_APP_ID is not set — no gig pages created"
    )
    return []
  }
  try {
    const response = await fetch(
      `https://rest.bandsintown.com/artists/virya/events?app_id=${appId}&date=upcoming`,
      { headers: { Accept: "application/json" } }
    )
    if (!response.ok) return []
    const data = await response.json()
    return Array.isArray(data) ? data.map(normalizeEvent).filter(Boolean) : []
  } catch (e) {
    console.error("[bandsintown] Error fetching gigs:", e.message)
    return []
  }
}

// A dedicated, indexable page per release. onCreatePage (below) mirrors each
// one to /pl/music/<slug> with lang context, same as the static pages.
exports.createPages = async ({ actions }) => {
  const { createPage } = actions
  const releaseComponent = path.resolve("src/templates/release.js")
  const gigComponent = path.resolve("src/templates/gig.js")

  releases.forEach(release => {
    const slug = slugify(release.title)
    createPage({
      path: `/music/${slug}`,
      component: releaseComponent,
      context: { release, slug },
    })
    createPage({
      path: `/pl/music/${slug}`,
      component: releaseComponent,
      context: { release, slug, lang: "pl" },
    })
  })

  const gigs = await fetchGigs()
  gigs
    .filter(gig => gig.id)
    .forEach(gig => {
      const slug = gigSlug(gig)
      createPage({
        path: `/shows/${slug}`,
        component: gigComponent,
        context: { gig, slug },
      })
      createPage({
        path: `/pl/shows/${slug}`,
        component: gigComponent,
        context: { gig, slug, lang: "pl" },
      })
    })
}

exports.onCreatePage = ({ page, actions }) => {
  const { createPage } = actions

  if (page.path === "/pl" || page.path.startsWith("/pl/")) return

  createPage({
    ...page,
    path: `/pl${page.path}`,
    context: { ...page.context, lang: "pl" },
  })
}
