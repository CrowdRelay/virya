"use client"
import React from "react"
import LegalPage from "../../components/legalPage"
import { getSeoTags } from "../../utils/seo"

const Terms = () => <LegalPage pageKey="terms" />

export const Head = ({ pageContext }) => {
  const lang = pageContext?.lang || "en"
  const { canonicalUrl, hreflangLinks } = getSeoTags("/legal/terms/", lang)
  const title = lang === "pl" ? "Regulamin | Virya" : "Terms & Conditions | Virya"
  const description = lang === "pl"
    ? "Regulamin oficjalnego sklepu merchu Virya — zamawianie, ceny, płatność, dostawa i Twoje prawa konsumenta."
    : "Terms and conditions for the Virya official merch store — ordering, prices, payment, delivery and your consumer rights."

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

export default Terms
