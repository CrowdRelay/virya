export interface EventCity {
  id: string
  slug: string
  name: string
  country_code: string
  region: string | null
}

export interface PublicEvent {
  id: string
  slug: string
  title: string
  description: string | null
  city: EventCity | null
  venue: string | null
  venue_address: string | null
  timezone: string
  starts_at: string
  doors_at: string | null
  ends_at: string | null
  ticket_url: string | null
  listen_url: string | null
  image_url: string | null
  trailer_url: string | null
  external_event_url: string | null
  updated_at: string
  source?: "crowdrelay" | "bandsintown" | "curated"
}

export interface CitySignal {
  slug: string
  name: string
  country_code: string
  fan_count: number
}

export interface FanSignupInput {
  email: string
  city_slug: string
  display_name?: string
  locale?: string
  referral_code?: string
  campaign_id?: string
  consent: {
    marketing: true
    policy_version: string
  }
}

export interface FanSignupResult {
  fan_id: string
  status: "pending" | "active"
  referral_url: string | null
  confirmation_required: boolean
}

export interface FanConfirmationResult {
  fan_id: string
  status: "active"
  referral_url: string
}

export interface FanUnsubscribeResult {
  fan_id: string
  status: "unsubscribed" | "suppressed"
}

export interface EventInterestResult {
  event_id: string
  fan_id: string
  created: boolean
  reminder_count: number
}

export interface ConcertCheckinResult {
  event_id: string
  event_slug: string
  campaign_id: string
  created: boolean
  checked_in_at: string
}

export interface FanEventInterest {
  event: PublicEvent
  interested_at: string
}

export interface MerchCoupon {
  id: string
  reward_grant_id: string
  reward_rule_id: string
  code: string
  discount_percent: number
  max_uses: number
  used_count: number
  status: "issued" | "redeemed" | "expired" | "revoked"
  expires_at: string | null
}

export interface WeightedDrawEntry {
  draw_id: string
  slug: string
  name: string
  prize_kind: "admission_pass" | "physical_item"
  closes_at: string
  draw_at: string
  qualified_referrals: number
  base_entries: number
  referral_entries: number
  concert_checkins: number
  checkin_entries: number
  total_entries: number
  max_entries: number
}

export interface PhysicalRewardGrant {
  reward_grant_id: string
  reward_rule_id: string
  item_name: string
  sku: string
  status: "issued" | "fulfilled" | "expired" | "revoked"
  granted_at: string
  expires_at: string | null
}

export interface ReferralProgress {
  referral_code: string
  qualified_referrals: number
  pending_referrals: number
  next_reward_threshold: number | null
  draw_entries: WeightedDrawEntry[]
  coupons: MerchCoupon[]
  physical_rewards: PhysicalRewardGrant[]
}

export type AdmissionPassStatus =
  | "issued"
  | "claimed"
  | "redeemed"
  | "revoked"
  | "expired"

export interface AdmissionPass {
  pass_id: string
  session_id: string | null
  event_id: string
  event_slug: string
  event_title: string
  venue: string | null
  starts_at: string
  holder_name: string | null
  holder_email_masked: string
  public_reference: string
  status: AdmissionPassStatus
  session_expires_at: string
  redeemed_at: string | null
}

export interface AdmissionQr {
  token: string
  expires_at: string
}

export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail?: string
  request_id?: string
}

export class CrowdRelayError extends Error {
  readonly status: number
  readonly problem?: ProblemDetails

  constructor(status: number, message: string, problem?: ProblemDetails) {
    super(message)
    this.name = "CrowdRelayError"
    this.status = status
    this.problem = problem
  }
}

interface RequestOptions {
  method?: "GET" | "POST"
  body?: unknown
  idempotencyKey?: string
  expectEmpty?: boolean
  timeoutMs?: number
}

export class CrowdRelayClient {
  readonly #baseUrl: URL
  readonly #timeoutMs: number
  readonly #fetch: typeof globalThis.fetch

  constructor(options: {
    baseUrl: string
    timeoutMs?: number
    fetch?: typeof globalThis.fetch
  }) {
    this.#baseUrl = new URL(ensureTrailingSlash(options.baseUrl))
    this.#timeoutMs = options.timeoutMs ?? 2_500
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  }

  async listCities(limit = 100): Promise<CitySignal[]> {
    const response = await this.#request<{ items: CitySignal[] }>(
      `public/cities?limit=${limit}`,
      { timeoutMs: 1_800 },
    )
    return response.items
  }

  async listEvents(limit = 20): Promise<PublicEvent[]> {
    const response = await this.#request<{ events: PublicEvent[] }>(
      `public/events?limit=${limit}`,
      { timeoutMs: 1_800 },
    )
    return response.events
  }

  getEvent(slug: string, campaignId?: string): Promise<PublicEvent> {
    return this.#request(
      `public/events/${encodeURIComponent(slug)}${campaignQuery(campaignId)}`,
      { timeoutMs: 1_800 },
    )
  }

  signupFan(
    input: FanSignupInput,
    idempotencyKey = newIdempotencyKey(),
  ): Promise<FanSignupResult> {
    return this.#request("fans", {
      method: "POST",
      body: input,
      idempotencyKey,
      timeoutMs: 5_000,
    })
  }

  confirmFan(token: string): Promise<FanConfirmationResult> {
    return this.#request("fans/confirm", {
      method: "POST",
      body: { token },
      timeoutMs: 5_000,
    })
  }

  unsubscribeFan(token: string): Promise<FanUnsubscribeResult> {
    return this.#request("fans/unsubscribe", {
      method: "POST",
      body: { token },
      timeoutMs: 5_000,
    })
  }

  registerEventInterest(
    slug: string,
    input: { campaign_id?: string; source?: string } = {},
    idempotencyKey = newIdempotencyKey(),
  ): Promise<EventInterestResult> {
    return this.#request(`events/${encodeURIComponent(slug)}/interest`, {
      method: "POST",
      body: input,
      idempotencyKey,
    })
  }

  checkInToEvent(
    slug: string,
    token: string,
    idempotencyKey = newIdempotencyKey(),
  ): Promise<ConcertCheckinResult> {
    return this.#request(`events/${encodeURIComponent(slug)}/check-in`, {
      method: "POST",
      body: { token },
      idempotencyKey,
      timeoutMs: 5_000,
    })
  }

  listMyEvents(limit = 50): Promise<FanEventInterest[]> {
    return this.#request(`me/events?limit=${limit}`)
  }

  getReferralProgress(): Promise<ReferralProgress> {
    return this.#request("me/referral")
  }

  claimAdmissionPass(token: string): Promise<AdmissionPass> {
    return this.#request("passes/claim", {
      method: "POST",
      body: { token },
      timeoutMs: 5_000,
    })
  }

  getMyAdmissionPass(): Promise<AdmissionPass> {
    return this.#request("me/pass")
  }

  getAdmissionQr(): Promise<AdmissionQr> {
    return this.#request("me/pass/qr")
  }

  async trackView(slug: string, campaignId?: string): Promise<void> {
    await this.#request<void>(
      `public/events/${encodeURIComponent(slug)}/view${campaignQuery(campaignId)}`,
      { method: "POST", expectEmpty: true, timeoutMs: 1_200 },
    )
  }

  async trackShare(slug: string, campaignId?: string): Promise<void> {
    await this.#request<void>(
      `public/events/${encodeURIComponent(slug)}/share${campaignQuery(campaignId)}`,
      { method: "POST", expectEmpty: true, timeoutMs: 1_200 },
    )
  }

  eventTicketUrl(slug: string, campaignId?: string): string {
    return this.#url(
      `public/events/${encodeURIComponent(slug)}/ticket${campaignQuery(campaignId)}`,
    ).toString()
  }

  eventListenUrl(slug: string, campaignId?: string): string {
    return this.#url(
      `public/events/${encodeURIComponent(slug)}/listen${campaignQuery(campaignId)}`,
    ).toString()
  }

  eventCalendarUrl(slug: string, campaignId?: string): string {
    return this.#url(
      `public/events/${encodeURIComponent(slug)}/calendar.ics${campaignQuery(campaignId)}`,
    ).toString()
  }

  smartLinkUrl(slug: string): string {
    return this.#url(`go/${encodeURIComponent(slug)}`).toString()
  }

  async #request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController()
    const timeout = globalThis.setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? this.#timeoutMs,
    )

    try {
      const headers = new Headers({ Accept: "application/json" })
      if (options.body !== undefined) {
        headers.set("Content-Type", "application/json")
      }
      if (options.idempotencyKey) {
        headers.set("Idempotency-Key", options.idempotencyKey)
      }

      const response = await this.#fetch(this.#url(path), {
        method: options.method ?? "GET",
        headers,
        credentials: "include",
        signal: controller.signal,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      })

      if (!response.ok) throw await toError(response)
      if (options.expectEmpty || response.status === 204) return undefined as T
      return (await response.json()) as T
    } catch (error) {
      if (error instanceof CrowdRelayError) throw error
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new CrowdRelayError(0, "CrowdRelay request timed out")
      }
      throw new CrowdRelayError(
        0,
        error instanceof Error ? error.message : "CrowdRelay request failed",
      )
    } finally {
      globalThis.clearTimeout(timeout)
    }
  }

  #url(path: string): URL {
    return new URL(path.replace(/^\//, ""), this.#baseUrl)
  }
}

async function toError(response: Response): Promise<CrowdRelayError> {
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/problem+json")) {
    const problem = (await response.json()) as ProblemDetails
    return new CrowdRelayError(
      response.status,
      problem.detail ?? problem.title,
      problem,
    )
  }
  return new CrowdRelayError(
    response.status,
    `CrowdRelay returned HTTP ${response.status}`,
  )
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`
}

function campaignQuery(campaignId?: string): string {
  return campaignId ? `?campaign_id=${encodeURIComponent(campaignId)}` : ""
}

function newIdempotencyKey(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `virya-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
