export type PublicDrawProofRef = {
  drawSlug: string
}

const knownDraws: Record<string, PublicDrawProofRef> = {
  namyslow: { drawSlug: "namyslow-guest-list-2026" },
  gorzow: { drawSlug: "gorzow-guest-list-2026" },
}

export function resolvePublicDrawProof(slug: string): PublicDrawProofRef {
  return knownDraws[slug] ?? { drawSlug: slug }
}
