import type { APIRoute } from "astro"
import {
  BUNDLES,
  discountedPrice,
  inventoryAvailability,
  toMinorUnits,
} from "../../../data/products"
import { fetchPublicMerchCatalog } from "../../../server/crowdrelayCommerce"

const STORE_ORIGIN = "https://virya.music"

const json = (
  payload: Record<string, unknown>,
  status: number,
  cacheControl: string,
) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  })

const imageUrl = (path: unknown) => {
  if (typeof path !== "string" || !path.trim()) return null
  const encoded = path
    .split("/")
    .map(segment => encodeURIComponent(segment))
    .join("/")
  return `${STORE_ORIGIN}/images/${encoded}`
}

const availabilityLabel = (state: { available: boolean; lowStock: boolean } | null) => {
  if (!state?.available) return "sold_out"
  return state.lowStock ? "low_stock" : "available"
}

const bundleCatalog = (
  inventoryBySku: Record<string, { available: boolean; availability: string }>,
) =>
  BUNDLES.map(bundle => {
    const variants = Array.isArray(bundle.sizes)
      ? bundle.sizes.map(size => {
          const state = inventoryAvailability(bundle, size, inventoryBySku)
          return {
            label: size,
            available: state?.available === true,
            availability: availabilityLabel(state),
          }
        })
      : []
    const state = inventoryAvailability(bundle, "", inventoryBySku)
    return {
      slug: bundle.id,
      name: bundle.name_pl ?? bundle.name,
      description: bundle.blurb_pl ?? bundle.blurb ?? null,
      includes: Array.isArray(bundle.includes_pl)
        ? bundle.includes_pl
        : Array.isArray(bundle.includes)
          ? bundle.includes
          : [],
      image_url: imageUrl(bundle.front),
      secondary_image_url: imageUrl(bundle.back),
      product_url: `${STORE_ORIGIN}/pl/merch/?source=signal-app&product=${encodeURIComponent(bundle.id)}`,
      currency: "PLN",
      price_gross_minor: toMinorUnits(discountedPrice(bundle)),
      original_price_gross_minor: toMinorUnits(bundle.price),
      available: state?.available === true,
      availability: availabilityLabel(state),
      variants,
    }
  })

export const GET: APIRoute = async () => {
  try {
    const catalog = await fetchPublicMerchCatalog(2_500)
    const variants = Object.fromEntries(
      catalog.products.flatMap(product =>
        product.variants.map(variant => [
          variant.sku,
          {
            available: variant.available,
            availability: variant.availability,
          },
        ]),
      ),
    )
    return json(
      {
        status: "ready",
        generatedAt: catalog.generated_at,
        variants,
        bundles: bundleCatalog(variants),
      },
      200,
      "public, max-age=15, stale-while-revalidate=60",
    )
  } catch (error) {
    console.warn("[merch-inventory] CrowdRelay availability unavailable", error)
    return json(
      { status: "unavailable", variants: {}, bundles: [] },
      503,
      "no-store",
    )
  }
}
