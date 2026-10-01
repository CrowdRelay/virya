import type { FanSignupInput, FanSignupResult } from "./crowdrelay-client.ts"

export type SignalSignupContext = Pick<
  FanSignupInput,
  "city_slug" | "display_name" | "campaign_id" | "referral_code" | "ad_attribution"
>

/** Capture only explicit opt-in. City enriches a signup; it never gates one. */
export function signalSignupInput(
  email: string,
  locale: string,
  consent: boolean,
  context: SignalSignupContext = {},
): FanSignupInput {
  const address = email.trim()
  if (!consent) throw new Error("Explicit marketing consent is required")
  if (address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    throw new Error("Invalid email")
  }
  const { city_slug, display_name, ...attribution } = context
  const city = city_slug?.trim()
  const name = display_name?.trim()
  return {
    ...attribution,
    email: address,
    locale,
    ...(city ? { city_slug: city } : {}),
    ...(name ? { display_name: name } : {}),
    consent: { marketing: true, policy_version: "virya-signal-v1" },
  }
}

/**
 * Keep ambiguous retries on the same operation, including after an input edit.
 * A received response ends the operation: the next submit must recheck the
 * server's confirmation/recovery cooldown instead of replaying an old reply.
 */
export function createSignalSignupSubmitter(
  client: { signupFan(input: FanSignupInput, key: string): Promise<FanSignupResult> },
  newKey: () => string = () => crypto.randomUUID(),
): (input: FanSignupInput) => Promise<FanSignupResult> {
  type Attempt = { key: string; inFlight?: Promise<FanSignupResult> }
  const attempts = new Map<string, Attempt>()
  return input => {
    const body = JSON.stringify(input)
    let attempt = attempts.get(body)
    if (!attempt) {
      attempt = { key: newKey() }
      attempts.set(body, attempt)
    }
    if (attempt.inFlight) return attempt.inFlight

    const current = attempt
    const request = JSON.parse(body) as FanSignupInput
    current.inFlight = Promise.resolve()
      .then(() => client.signupFan(request, current.key))
      .then(result => {
        attempts.delete(body)
        return result
      })
      .finally(() => {
        current.inFlight = undefined
      })
    return current.inFlight
  }
}

export type SignalOffer = "shows" | "releases"

/** Only known offers can select copy; URL text is never rendered as copy. */
export function signalOfferFromSearch(search: string): SignalOffer | undefined {
  const offer = new URLSearchParams(search).get("offer")
  return offer === "shows" || offer === "releases" ? offer : undefined
}

export function signalOfferCopy(offer: SignalOffer, lang: "en" | "pl"): string {
  if (offer === "shows") {
    return lang === "pl"
      ? "Dowiaduj się o koncertach Viryi. Dodaj miasto, jeśli chcesz alerty o koncertach w pobliżu."
      : "Hear about Virya shows. Add your city if you want nearby show alerts."
  }
  return lang === "pl"
    ? "Dostawaj wiadomości od Viryi o nowej muzyce i materiałach zespołu, bez polegania na zasięgach social mediów."
    : "Get updates from Virya about new music and band material, without relying on the social feed."
}
