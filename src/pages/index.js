import React from "react"
import PageClient from "../components/pageClient"
import releases from "../components/portfolio/items.json"
import { getSeoTags } from "../utils/seo"

const Main = () => <PageClient />

const SITE = "https://www.virya.music"
const BAND_ID = SITE + "/#band"

const slugify = s =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

// Spotify /album/ links are full releases (album or EP); /track/ links are
// standalone singles. Enrich each with a stable @id, cover image, description
// and cross-platform sameAs so Google can tie the releases to the band entity.
const releaseSchema = releases.map(r => {
  const isAlbum = r.link && r.link.includes("/album/")
  const isEp = /from the ashes/i.test(r.title)
  return {
    "@type": isAlbum ? "MusicAlbum" : "MusicRecording",
    "@id": `${SITE}/#release-${slugify(r.title)}`,
    name: r.title,
    url: r.link,
    image: `${SITE}/covers/${r.src}`,
    description: r.text,
    genre: ["Metalcore", "Modern Metal"],
    byArtist: { "@id": BAND_ID },
    sameAs: [r.link, r.watch, r.buy].filter(Boolean),
    ...(isAlbum && {
      albumReleaseType: isEp
        ? "https://schema.org/EPRelease"
        : "https://schema.org/AlbumRelease",
    }),
    ...(/echoes of the modern mind/i.test(r.title) && { numTracks: 11 }),
  }
})

const albumRefs = releaseSchema
  .filter(r => r["@type"] === "MusicAlbum")
  .map(r => ({ "@id": r["@id"] }))
const trackRefs = releaseSchema
  .filter(r => r["@type"] === "MusicRecording")
  .map(r => ({ "@id": r["@id"] }))

const metaTags = {
  title: "Virya | Modern metalcore from Poland",
  description:
    "A website of Virya, a new modern metalcore powerhorse from Poland. Check out the latest releases and news.",
  image: "https://www.virya.music/virya.webp",
  url: "https://www.virya.music",
  keywords:
    "Virya, Music, Band, Metalcore, Modern Metal, Modern Metalcore, Heavy, Melodic, Virtuoso, Alternative",
}

const musicGroupSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MusicGroup",
      "@id": BAND_ID,
      name: "Virya",
      genre: [
        "Metalcore",
        "Alternative Metal",
        "Progressive Metal",
        "Modern Metal",
      ],
      description: "Modern metalcore band from Poland",
      url: "https://www.virya.music",
      image: "https://www.virya.music/virya.webp",
      foundingDate: "2023",
      foundingLocation: { "@type": "Place", name: "Wrocław, Poland" },
      logo: {
        "@type": "ImageObject",
        url: "https://www.virya.music/virya.webp",
      },
      areaServed: {
        "@type": "Country",
        name: "Poland",
      },
      member: [
        {
          "@type": "OrganizationRole",
          member: { "@type": "Person", name: "Wojciech Bator" },
          roleName: "Guitar",
        },
        {
          "@type": "OrganizationRole",
          member: { "@type": "Person", name: "Marek Bienias" },
          roleName: "Vocals",
        },
        {
          "@type": "OrganizationRole",
          member: { "@type": "Person", name: "Jakub D\u0105browski" },
          roleName: "Drums",
        },
        {
          "@type": "OrganizationRole",
          member: { "@type": "Person", name: "Lubomyr Kosakovsky" },
          roleName: "Bass",
        },
      ],
      sameAs: [
        "https://www.wikidata.org/wiki/Q140288998",
        "https://www.instagram.com/virya.official",
        "https://www.facebook.com/ViryaBand",
        "https://open.spotify.com/artist/6bbW0jOKAWJWm3h6CTWaAS",
        "https://virya.bandcamp.com",
        "https://www.bandsintown.com/a/15587796",
        "https://www.youtube.com/@ViryaOfficial",
        "https://soundcloud.com/viryaofficial",
        "https://musicbrainz.org/artist/dd4ae253-4f61-4115-9e5e-dce4ed601ab5",
        "https://x.com/viryaofficial",
        "https://music.apple.com/us/artist/virya/1770472152",
      ],
      album: albumRefs,
      track: trackRefs,
    },
    ...releaseSchema,
  ],
})

export const Head = ({ pageContext }) => {
    const lang = pageContext?.lang || "en"
    const { canonicalUrl, hreflangLinks } = getSeoTags("/", lang)
    const ogLocale = lang === "pl" ? "pl_PL" : "en_US"
    const title = lang === "pl" ? "Virya | Nowoczesny metalcore z Polski" : metaTags.title
    const description = lang === "pl"
        ? "Strona Virya, nowoczesnej metalcoreowej siły z Polski. Sprawdź najnowsze wydawnictwa i wiadomości."
        : metaTags.description

    return (
        <>
            <title>{title}</title>
            <link rel="preload" as="image" href="/poster.webp" fetchpriority="high" />
            {/* Spotify embed is lazy-loaded far below the fold, so we only warm
                DNS — a preconnect here sits unused and Lighthouse flags it. */}
            <link rel="dns-prefetch" href="https://open.spotify.com" />
            <link rel="canonical" href={canonicalUrl} />
            {hreflangLinks.map((link, i) => (
                <link key={i} rel={link.rel} hrefLang={link.hreflang} href={link.href} />
            ))}
            <meta name="description" content={description} />
            <meta name="keywords" content={metaTags.keywords} />
            <meta name="author" content="Virya" />
            <meta name="theme-color" content="#09090b" />
            <meta property="og:type" content="website" />
            <meta property="og:site_name" content="Virya" />
            <meta property="og:locale" content={ogLocale} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={metaTags.image} />
            <meta property="og:url" content={canonicalUrl} />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:site" content="@viryaofficial" />
            <meta name="twitter:creator" content="@viryaofficial" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={metaTags.image} />
            <meta name="twitter:url" content={canonicalUrl} />
            <script type="application/ld+json">{musicGroupSchema}</script>
        </>
    )
}

export default Main
