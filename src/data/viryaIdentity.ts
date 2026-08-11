export const VIRYA_IDENTITY = {
  "@context": "https://schema.org",
  "@type": "MusicGroup",
  "@id": "https://www.virya.music/#band",
  name: "VIRYA",
  alternateName: ["Virya band", "Virya Wrocław"],
  url: "https://www.virya.music/",
  image: "https://www.virya.music/poster.webp",
  genre: ["Modern metal", "Metalcore", "Alternative metal"],
  foundingLocation: {
    "@type": "Place",
    name: "Wrocław, Poland",
  },
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
