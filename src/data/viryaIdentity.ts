export const VIRYA_IDENTITY = {
  "@context": "https://schema.org",
  "@type": "MusicGroup",
  "@id": "https://virya.music/#band",
  name: "VIRYA",
  alternateName: ["Virya band", "Virya Wrocław"],
  url: "https://virya.music/",
  image: "https://virya.music/poster.webp",
  foundingDate: "2023",
  genre: ["Modern metal", "Metalcore", "Alternative metal"],
  foundingLocation: {
    "@type": "Place",
    name: "Wrocław, Poland",
  },
  member: [
    { "@type": "Person", name: "Marcin Janusiński", roleName: "Vocals" },
    { "@type": "Person", name: "Wojciech Bator", roleName: "Guitar" },
    { "@type": "Person", name: "Jakub Dąbrowski", roleName: "Drums" },
    { "@type": "Person", name: "Lubomyr Kosakovsky", roleName: "Bass" },
  ],
  sameAs: [
    "https://www.instagram.com/virya.official",
    "https://www.youtube.com/@ViryaOfficial",
    "https://www.facebook.com/ViryaBand",
    "https://open.spotify.com/artist/6bbW0jOKAWJWm3h6CTWaAS",
    "https://virya.bandcamp.com",
    "https://www.bandsintown.com/a/15587796-virya",
  ],
} as const

export function serializeViryaIdentity(): string {
  return JSON.stringify(VIRYA_IDENTITY).replace(/</g, "\\u003c")
}
