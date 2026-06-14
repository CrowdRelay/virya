import React from "react"
import MerchClient from "../components/merch/merchClient"
import { PRODUCTS, CURRENCY } from "../data/products"

const Main = () => <MerchClient />

const metaTags = {
  title: "Merch | Virya - Official Store",
  description:
    "Official Virya merch — Echoes Of The Modern Mind album, tees and a tote bag. Free stickers with every order. Pay with BLIK, Google Pay, Revolut Pay or card. InPost Paczkomat delivery.",
  image: "https://www.virya.music/virya.webp",
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

export const Head = () => (
  <>
    <title>{metaTags.title}</title>
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
    <script type="application/ld+json">{storeSchema}</script>
  </>
)

export default Main
