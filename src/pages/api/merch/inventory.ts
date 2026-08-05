import type { APIRoute } from "astro"
import { fetchPublicMerchCatalog } from "../../../server/crowdrelayCommerce"

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
      },
      200,
      "public, max-age=15, stale-while-revalidate=60",
    )
  } catch (error) {
    console.warn("[merch-inventory] CrowdRelay availability unavailable", error)
    return json(
      { status: "unavailable", variants: {} },
      503,
      "no-store",
    )
  }
}
