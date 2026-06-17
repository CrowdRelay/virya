import React from "react"
import MerchClient from "../components/merch/merchClient"
import { PRODUCTS, CURRENCY } from "../data/products"
import { getSeoTags } from "../utils/seo"

const Main = () => <MerchClient />

const metaTags = {
  title: "Merch | Virya - Official Store",
  description:
    "Official Virya merch — Echoes Of The Modern Mind album, tees and a tote bag. Free stickers with every order. Pay with BLIK, Google Pay, Revolut Pay or card. InPost Paczkomat delivery.",
  image: "https://www.virya.music/merch-og.webp",
  url: "https://www.virya.music/merch",
  keywords:
    "Virya, Merch, Store, Metalcore, T-shirt, Album, Echoes Of The Modern Mind, BLIK, InPost",
}

const storeSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Store",
  name: "Virya Official Store",
  url: metaTags.url,
  image: metaTags.image,
  itemListElement: PRODUCTS.map(p => ({
    "@type": "Product",
    name: p.name,
    offers: {
      "@type": "Offer",
      price: p.price,
      priceCurrency: CURRENCY.toUpperCase(),
      availability: "https://schema.org/InStock",
    },
  })),
})

export const Head = ({ pageContext }) => {
  const lang = pageContext?.lang || "en"
  const { canonicalUrl, hreflangLinks } = getSeoTags("/merch", lang)
  const ogLocale = lang === "pl" ? "pl_PL" : "en_US"
  const title = lang === "pl" ? "Sklep | Virya - Oficjalny sklep" : metaTags.title
  const description = lang === "pl"
    ? "Oficjalny merch Virya — album Echoes Of The Modern Mind, koszulki i torba. Darmowe naklejki do każdego zamówienia. Płać BLIK, Google Pay, Revolut Pay lub kartą. Dostawa do Paczkomatu InPost."
    : metaTags.description

  return (
    <>
      <title>{title}</title>
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
      <script type="application/ld+json">{storeSchema}</script>
    </>
  )
}

export default Main
