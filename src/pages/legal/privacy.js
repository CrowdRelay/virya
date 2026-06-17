"use client"
import React from "react"
import LegalPage, { Section, Note } from "../../components/legalPage"

const Privacy = () => (
  <LegalPage title="Privacy Policy" lastUpdated="17 June 2026">
    <Note>
      Confirm the data controller's legal identity and address before going
      live. The processors listed below reflect the current stack — keep them in
      sync if the tooling changes.
    </Note>

    <div className="mt-8">
      <Section heading="Who we are">
        <p>
          The data controller is Virya (<em>[legal name & address — to be
          completed]</em>). For any privacy request, contact{" "}
          <a
            href="mailto:virya.crew@gmail.com"
            className="text-amber-400 underline underline-offset-2"
          >
            virya.crew@gmail.com
          </a>
          .
        </p>
      </Section>

      <Section heading="What we collect & why">
        <p>
          When you contact us or subscribe, we process your email (and name, if
          given) to reply and to send updates you asked for. When you order
          merch, we process your name, email, delivery point and billing details
          to fulfil and invoice the order. Legal bases: performance of a
          contract, your consent (newsletter), and our legitimate interest in
          responding to enquiries.
        </p>
      </Section>

      <Section heading="Who processes your data">
        <div className="space-y-1">
          <p>We share data only with processors needed to run the service:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Stripe — payment processing</li>
            <li>InPost — parcel delivery</li>
            <li>Netlify — site hosting and form storage</li>
            <li>Google (Gmail) — sending and receiving email</li>
          </ul>
        </div>
      </Section>

      <Section heading="Retention">
        <p>
          We keep order and invoicing data for as long as required by tax and
          accounting law, and newsletter data until you unsubscribe. Enquiry
          messages are kept only as long as needed to handle them.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          Under the GDPR you may access, rectify, erase, restrict or port your
          data, object to processing, and withdraw consent at any time. You also
          have the right to lodge a complaint with the Polish supervisory
          authority (UODO).
        </p>
      </Section>

      <Section heading="Cookies">
        <p>
          The site uses only what is needed to function and to remember your
          cart. Embedded players (e.g. Spotify, YouTube) may set their own
          cookies when loaded.
        </p>
      </Section>
    </div>
  </LegalPage>
)

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
