"use client"
import React from "react"
import LegalPage, { Section, Note } from "../../components/legalPage"

const Returns = () => (
  <LegalPage title="Returns & Refunds" lastUpdated="17 June 2026">
    <Note>
      Add the physical return address before going live, so customers know where
      to send withdrawn or faulty items.
    </Note>

    <div className="mt-8">
      <Section heading="14-day right of withdrawal">
        <p>
          If you are a consumer, you may withdraw from your purchase within 14
          days of receiving the goods, without giving a reason. To do so, send a
          clear statement of withdrawal to{" "}
          <a
            href="mailto:virya.crew@gmail.com"
            className="text-amber-400 underline underline-offset-2"
          >
            virya.crew@gmail.com
          </a>{" "}
          quoting your order number.
        </p>
      </Section>

      <Section heading="Returning the goods">
        <p>
          Return the items within 14 days of notifying us, to:{" "}
          <em>[return address — to be completed]</em>. Goods should be returned
          unused and in their original condition. You cover the direct cost of
          return shipping.
        </p>
      </Section>

      <Section heading="Refunds">
        <p>
          We refund the full amount you paid for the returned goods, including
          the original standard delivery cost, within 14 days of receiving your
          withdrawal — using the same payment method you used, at no extra
          charge. We may withhold the refund until the goods are returned.
        </p>
      </Section>

      <Section heading="Faulty or damaged items">
        <p>
          If an item arrives damaged or defective, contact us within a
          reasonable time. Under statutory warranty (rękojmia) you may request
          repair, replacement, a price reduction, or — for material defects — a
          refund. We cover return shipping for confirmed faults.
        </p>
      </Section>

      <Section heading="Sizes & restocks">
        <p>
          Check the size guidance on each product before ordering. If your size
          is sold out, tap it on the product to register demand — we use that to
          decide restocks and will reach out if it returns.
        </p>
      </Section>
    </div>
  </LegalPage>
)

export const Head = () => (
  <>
    <title>Returns & Refunds | Virya</title>
    <meta
      name="description"
      content="Returns and refunds for the Virya merch store — your 14-day right of withdrawal, how to return items, and how refunds work."
    />
    <link rel="canonical" href="https://www.virya.music/legal/returns/" />
  </>
)

export default Returns
