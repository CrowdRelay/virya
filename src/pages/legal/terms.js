"use client"
import React from "react"
import LegalPage, { Section, Note } from "../../components/legalPage"

const Terms = () => (
  <LegalPage title="Terms & Conditions" lastUpdated="17 June 2026">
    <Note>
      Placeholder seller details below must be completed with Virya's registered
      business information (legal name, address, tax ID / NIP, REGON) before the
      store handles live orders.
    </Note>

    <div className="mt-8">
      <Section heading="1. Seller">
        <p>
          The online store at virya.music ("Store") is operated by Virya
          ("Seller"). Registered business name, address and tax identification
          number: <em>[to be completed]</em>. Contact:{" "}
          <a
            href="mailto:virya.crew@gmail.com"
            className="text-amber-400 underline underline-offset-2"
          >
            virya.crew@gmail.com
          </a>
          .
        </p>
      </Section>

      <Section heading="2. Products & prices">
        <p>
          All prices are shown in Polish złoty (PLN) and include 23% VAT.
          Delivery is charged separately as a flat fee shown at checkout.
          Promotional prices apply only while the relevant promotion is active.
        </p>
      </Section>

      <Section heading="3. Orders">
        <p>
          Placing an order by completing checkout and paying constitutes an
          offer to buy the selected items. A contract of sale is concluded when
          the Seller confirms the order by email. Product availability and sizes
          are limited; if an item becomes unavailable after payment, the Seller
          will contact you and refund the affected amount.
        </p>
      </Section>

      <Section heading="4. Payment">
        <p>
          Payments are processed securely by Stripe. Available methods include
          BLIK, Google Pay, Revolut Pay and payment cards. The Seller does not
          store your full card details.
        </p>
      </Section>

      <Section heading="5. Delivery">
        <p>
          Orders are shipped to the InPost Paczkomat you select at checkout,
          within Poland. Estimated dispatch is within a few business days of
          payment; delivery times depend on the InPost network.
        </p>
      </Section>

      <Section heading="6. Withdrawal & complaints">
        <p>
          Consumers have the right to withdraw from the contract within 14 days
          and to make complaints about defective goods. See our{" "}
          <a
            href="/legal/returns"
            className="text-amber-400 underline underline-offset-2"
          >
            Returns & Refunds
          </a>{" "}
          policy for details.
        </p>
      </Section>

      <Section heading="7. Governing law">
        <p>
          These terms are governed by Polish law and do not limit any mandatory
          consumer rights. Disputes may be submitted to the EU Online Dispute
          Resolution platform at{" "}
          <a
            href="https://ec.europa.eu/consumers/odr"
            target="_blank"
            rel="noreferrer"
            className="text-amber-400 underline underline-offset-2"
          >
            ec.europa.eu/consumers/odr
          </a>
          .
        </p>
      </Section>
    </div>
  </LegalPage>
)

export const Head = () => (
  <>
    <title>Terms & Conditions | Virya</title>
    <meta
      name="description"
      content="Terms and conditions for the Virya official merch store — ordering, prices, payment, delivery and your consumer rights."
    />
    <link rel="canonical" href="https://www.virya.music/legal/terms/" />
  </>
)

export default Terms
