import React from "react"
import PageClient from "../components/pageClient"
import releases from "../components/portfolio/items.json"

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

export const Head = () => (
    <>
        <title>{metaTags.title}</title>
        <link rel="preload" as="image" href="/poster.webp" fetchpriority="high" />
        <link rel="dns-prefetch" href="https://open.spotify.com" />
        <link rel="preconnect" href="https://open.spotify.com" crossOrigin="anonymous" />
        <link rel="canonical" href={metaTags.url} />
        <meta name="description" content={metaTags.description} />
        <meta name="keywords" content={metaTags.keywords} />
        <meta name="author" content="Virya" />
        <meta name="theme-color" content="#09090b" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Virya" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:title" content={metaTags.title} />
        <meta property="og:description" content={metaTags.description} />
        <meta property="og:image" content={metaTags.image} />
        <meta property="og:url" content={metaTags.url} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@viryaofficial" />
        <meta name="twitter:creator" content="@viryaofficial" />
        <meta name="twitter:title" content={metaTags.title} />
        <meta name="twitter:description" content={metaTags.description} />
        <meta name="twitter:image" content={metaTags.image} />
        <meta name="twitter:url" content={metaTags.url} />
        <script type="application/ld+json">{musicGroupSchema}</script>
    </>
)

export default Main
