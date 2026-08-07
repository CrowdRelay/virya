export type PublicDrawProofRef = {
  drawSlug: string
  title?: string
  drawAt?: string
}

const knownDraws: Record<string, PublicDrawProofRef> = {
  namyslow: {
    drawSlug: "namyslow-guest-list-2026",
    title: "4 wejściówki — Namysłów",
    drawAt: "2026-09-01T20:05:00+02:00",
  },
  "namyslow-guest-list-2026": {
    drawSlug: "namyslow-guest-list-2026",
    title: "4 wejściówki — Namysłów",
    drawAt: "2026-09-01T20:05:00+02:00",
  },
}

export function resolvePublicDrawProof(slug: string): PublicDrawProofRef {
  return knownDraws[slug] ?? { drawSlug: slug }
}
