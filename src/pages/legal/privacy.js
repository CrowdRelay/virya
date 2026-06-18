"use client"
import React from "react"
import LegalPage from "../../components/legalPage"
import { getSeoTags } from "../../utils/seo"

const Privacy = () => <LegalPage pageKey="privacy" />

export const Head = ({ pageContext }) => {
  const lang = pageContext?.lang || "en"
  const { canonicalUrl, hreflangLinks } = getSeoTags("/legal/privacy/", lang)
  const title = lang === "pl" ? "Polityka prywatności | Virya" : "Privacy Policy | Virya"
  const description = lang === "pl"
    ? "Jak Virya przetwarza Twoje dane osobowe — co zbieramy, kto przetwarza, jak długo przechowujemy i Twoje prawa zgodnie z RODO."
    : "How Virya handles your personal data — what we collect, who processes it, how long we keep it, and your GDPR rights."

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {hreflangLinks.map((link, i) => (
        <link key={i} rel={link.rel} hrefLang={link.hreflang} href={link.href} />
      ))}
    </>
  )
}

export default Privacy
