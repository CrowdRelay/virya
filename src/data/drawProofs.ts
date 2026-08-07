export type PublicDrawProofRef = {
  drawSlug: string
  title?: string
}

const knownDraws: Record<string, PublicDrawProofRef> = {
  namyslow: {
    drawSlug: "namyslow-guest-list-2026",
    title: "4 wejściówki — Namysłów",
  },
  "namyslow-guest-list-2026": {
    drawSlug: "namyslow-guest-list-2026",
    title: "4 wejściówki — Namysłów",
  },
}

export function resolvePublicDrawProof(slug: string): PublicDrawProofRef {
  return knownDraws[slug] ?? { drawSlug: slug }
}
