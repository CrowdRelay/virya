const path = require("path")
const { createRemoteFileNode } = require("gatsby-source-filesystem")
const releases = require("./src/components/portfolio/items.json")

const GIG_NODE_TYPE = "Gig"

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
    const gigs = Array.isArray(data)
      ? data.map(normalizeEvent).filter(Boolean)
      : []
    // The events API only fills artist.image_url on one event; the rest come
    // back null. Reuse the first available band photo for every gig so they all
    // get a header image instead of a blank placeholder.
    const fallbackImage = gigs.find(g => g.image)?.image || null
    return gigs.map(g => ({ ...g, image: g.image || fallbackImage }))
  } catch (e) {
    console.error("[bandsintown] Error fetching gigs:", e.message)
    return []
  }
}

// Download each gig's remote header image into a File node at build time so it
// can be processed by sharp (responsive AVIF/WebP, explicit dimensions, served
// from our own host). Without this the raw BandsInTown JPEG tanks LCP and CLS.
exports.sourceNodes = async ({
  actions,
  createNodeId,
  createContentDigest,
  getCache,
}) => {
  const { createNode } = actions
  const gigs = await fetchGigs()

  for (const gig of gigs.filter(g => g.id)) {
    const nodeId = createNodeId(`gig-${gig.id}`)
    let imageFileId = null

    if (gig.image) {
      try {
        const fileNode = await createRemoteFileNode({
          url: gig.image,
          parentNodeId: nodeId,
          createNode,
          createNodeId,
          getCache,
        })
        imageFileId = fileNode?.id ?? null
      } catch (e) {
        console.warn(
          `[bandsintown] could not download image for gig ${gig.id}: ${e.message}`
        )
      }
    }

    createNode({
      ...gig,
      id: nodeId,
      gigId: gig.id,
      imageUrl: gig.image, // original absolute URL, kept for og:image / schema
      imageFile___NODE: imageFileId,
      internal: {
        type: GIG_NODE_TYPE,
        contentDigest: createContentDigest(gig),
      },
    })
  }
}

// A dedicated, indexable page per release and per gig. onCreatePage (below)
// mirrors each one to /pl/<path> with lang context, same as the static pages.
exports.createPages = async ({ actions, graphql }) => {
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

  const result = await graphql(`
    query {
      allGig {
        nodes {
          gigId
          title
          date
          event
          tickets
          venueName
          city
          lineup
          description
          imageUrl
          imageFile {
            childImageSharp {
              gatsbyImageData(
                width: 728
                placeholder: BLURRED
                formats: [AUTO, WEBP, AVIF]
                quality: 80
              )
            }
          }
        }
      }
    }
  `)

  if (result.errors) {
    console.error("[bandsintown] gig page query failed", result.errors)
    return
  }

  result.data.allGig.nodes.forEach(node => {
    const slug = gigSlug({ id: node.gigId })
    const gig = {
      id: node.gigId,
      title: node.title,
      date: node.date,
      event: node.event,
      tickets: node.tickets,
      venueName: node.venueName,
      city: node.city,
      lineup: node.lineup,
      description: node.description,
      imageUrl: node.imageUrl,
      image: node.imageFile?.childImageSharp?.gatsbyImageData ?? null,
    }
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
