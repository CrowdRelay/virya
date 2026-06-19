import React from "react"
import { graphql } from "gatsby"
import MerchClient from "../components/merch/merchClient"
import {
  ALL_PRODUCTS,
  CURRENCY,
  DISCOUNT_UNTIL,
  discountActive,
  discountedPrice,
  productInStock,
} from "../data/products"
import { getSeoTags } from "../utils/seo"

const Main = () => <MerchClient />

const metaTags = {
  title: "Merch | Virya - Official Store",
  description:
    "Official Virya merch — Echoes Of The Modern Mind album, tees and a tote bag. Free stickers with every order. Pay with BLIK, Google Pay, Revolut Pay or card. InPost Paczkomat delivery.",
  image: "https://www.virya.music/merch-og.webp",
  keywords:
    "Virya, Merch, Store, Metalcore, T-shirt, Album, Echoes Of The Modern Mind, BLIK, InPost",
}

const priceValidUntil = DISCOUNT_UNTIL ? DISCOUNT_UNTIL.slice(0, 10) : undefined

const buildStoreSchema = url =>
  JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Store",
    name: "Virya Official Store",
    image: metaTags.image,
    url,
    itemListElement: ALL_PRODUCTS.map(p => ({
      "@type": "Product",
      name: p.name,
      ...(p.blurb ? { description: p.blurb } : {}),
      brand: { "@type": "Brand", name: "Virya" },
      offers: {
        "@type": "Offer",
        price: discountedPrice(p),
        priceCurrency: CURRENCY.toUpperCase(),
        url,
        availability: productInStock(p)
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        ...(discountActive() && priceValidUntil ? { priceValidUntil } : {}),
      },
    })),
  })

// Mirror useMerchImages exactly so the preloaded files are the same ones the
// first <picture> requests — no duplicate download.
export const query = graphql`
  query {
    lcp: file(
      sourceInstanceName: { eq: "img" }
      relativePath: { eq: "merch/echoes.webp" }
    ) {
      childImageSharp {
        gatsbyImageData(
          width: 400
          placeholder: BLURRED
          formats: [AUTO, WEBP, AVIF]
          quality: 70
          outputPixelDensities: [1, 1.5, 2, 3]
          sizes: "(min-width: 1024px) 33vw, 48vw"
        )
      }
    }
  }
`

export const Head = ({ pageContext, data }) => {
  const lang = pageContext?.lang || "en"
  const { canonicalUrl, hreflangLinks } = getSeoTags("/merch", lang)
  // Preload the first product image (the LCP element) so the browser fetches
  // it from the document head at high priority instead of discovering it deep
  // in the body after CSS/JS. We preload the AVIF srcSet to match the picture's
  // first <source>; browsers without AVIF ignore it and fall back normally.
  const lcpImage = data?.lcp?.childImageSharp?.gatsbyImageData
  const avif = lcpImage?.images?.sources?.find(s => s.type === "image/avif")
  const ogLocale = lang === "pl" ? "pl_PL" : "en_US"
  const title = lang === "pl" ? "Sklep | Virya - Oficjalny sklep" : metaTags.title
  const description = lang === "pl"
    ? "Oficjalny merch Virya — album Echoes Of The Modern Mind, koszulki i torba. Darmowe naklejki do każdego zamówienia. Płać BLIK, Google Pay, Revolut Pay lub kartą. Dostawa do Paczkomatu InPost."
    : metaTags.description

  const schemaWithUrl = buildStoreSchema(canonicalUrl)

  return (
    <>
      <title>{title}</title>
      {avif && (
        <link
          rel="preload"
          as="image"
          type="image/avif"
          imageSrcSet={avif.srcSet}
          imageSizes={avif.sizes}
          fetchPriority="high"
        />
      )}
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
      <script type="application/ld+json">{schemaWithUrl}</script>
    </>
  )
}

export default Main
