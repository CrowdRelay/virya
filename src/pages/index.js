import React from "react"
import PageClient from "../components/pageClient"
import releases from "../components/portfolio/items.json"
import { getSeoTags } from "../utils/seo"

const Main = () => <PageClient />

const BAND_ID = "https://www.virya.music/#band"

const releaseSchema = releases.map(r => ({
  "@type":
    r.link && r.link.includes("/album/") ? "MusicAlbum" : "MusicRecording",
  name: r.title,
  url: r.link,
  byArtist: { "@id": BAND_ID },
  sameAs: [r.link, r.buy].filter(Boolean),
}))

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
      genre: ["Metalcore", "Metal", "Modern Metal"],
      description: "Modern metalcore band from Poland",
      url: "https://www.virya.music",
      image: "https://www.virya.music/virya.webp",
      foundingDate: "2023",
      foundingLocation: { "@type": "Place", name: "Poland" },
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
        "https://www.instagram.com/virya.official",
        "https://www.facebook.com/ViryaBand",
        "https://open.spotify.com/artist/6bbW0jOKAWJWm3h6CTWaAS",
        "https://virya.bandcamp.com",
        "http://youtube.com/@ViryaOfficial",
        "https://soundcloud.com/viryaofficial",
        "https://x.com/viryaofficial",
      ],
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
            <link rel="dns-prefetch" href="https://open.spotify.com" />
            <link rel="preconnect" href="https://open.spotify.com" crossOrigin="anonymous" />
            <link rel="canonical" href={canonicalUrl} />
            {hreflangLinks.map((link, i) => (
                <link key={i} rel={link.rel} hreflang={link.hreflang} href={link.href} />
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
