"use client"
import React from "react"
import LegalPage from "../../components/legalPage"
import { getSeoTags } from "../../utils/seo"

const Returns = () => <LegalPage pageKey="returns" />

export const Head = ({ pageContext }) => {
  const lang = pageContext?.lang || "en"
  const { canonicalUrl, hreflangLinks } = getSeoTags("/legal/returns/", lang)
  const title = lang === "pl" ? "Zwroty i reklamacje | Virya" : "Returns & Refunds | Virya"
  const description = lang === "pl"
    ? "Zwroty i reklamacje dla sklepu Virya — Twoje prawo do odstąpienia w 14 dni, jak zwracać rzeczy i jak działają zwroty."
    : "Returns and refunds for the Virya merch store — your 14-day right of withdrawal, how to return items, and how refunds work."

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {hreflangLinks.map((link, i) => (
        <link key={i} rel={link.rel} hreflang={link.hreflang} href={link.href} />
      ))}
    </>
  )
}

export default Returns
