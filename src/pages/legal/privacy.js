"use client"
import React from "react"
import LegalPage from "../../components/legalPage"

const Privacy = () => <LegalPage pageKey="privacy" />

export const Head = () => (
  <>
    <title>Privacy Policy | Virya</title>
    <meta
      name="description"
      content="How Virya handles your personal data — what we collect, who processes it, how long we keep it, and your GDPR rights."
    />
    <link rel="canonical" href="https://www.virya.music/legal/privacy/" />
  </>
)

export default Privacy
