import fs from 'node:fs'
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const cart=read('src/components/preact/merch/cartDrawer.jsx')
const checkout=read('src/pages/api/checkout.ts')
const webhook=read('src/pages/api/stripe-webhook.ts')
const commerce=read('src/server/crowdrelayCommerce.ts')
const checks = {
  clientPickup: cart.includes('fulfillmentMode') && cart.includes('pickupEventSlug') && cart.includes('effectiveShipping'),
  serverAuthority: checkout.includes('pickupEvent.source !== "crowdrelay"') && checkout.includes('loadLiveEvent') && checkout.includes('requiresInpost'),
  stripeMetadata: checkout.includes('pickup_event_id') && checkout.includes('fulfillment_mode'),
  shipmentSkip: webhook.includes('eventPickup') && webhook.includes('recordConfirmedMerchOrder'),
  factCheckpoint: webhook.includes('virya_merch_fact_done') && webhook.indexOf('virya_merch_fact_done') < webhook.indexOf('virya_processed: "1"'),
  commerceClient: commerce.includes('internal/merch/orders/confirmed'),
  paymentTimestamp: webhook.includes('new Date(event.created * 1000).toISOString()') && !webhook.includes('new Date(session.created * 1000).toISOString()'),
}
for (const [name, ok] of Object.entries(checks)) if (!ok) throw new Error(`FAIL ${name}`)
console.log(`MERCH_EVENT_PICKUP=PASS checks=${Object.keys(checks).length}`)
