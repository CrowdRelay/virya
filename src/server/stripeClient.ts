import Stripe from "stripe"

// One SDK instance per secret key per isolate. `new Stripe()` re-created
// HTTP-client state on every request — including inside the webhook, where
// provider retries multiply the work.
const cache = new Map<string, Stripe>()

export const stripeFor = (secretKey: string): Stripe => {
  let client = cache.get(secretKey)
  if (!client) {
    client = new Stripe(secretKey)
    // Bounded in case of key rotation; in practice this holds one entry.
    if (cache.size >= 4) cache.clear()
    cache.set(secretKey, client)
  }
  return client
}
