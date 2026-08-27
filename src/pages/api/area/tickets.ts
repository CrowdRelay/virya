import { randomBytes } from "node:crypto"
import type { APIRoute } from "astro"
import { getAreaActor } from "../../../server/areaActor"
import {
  CrowdRelayAreaError,
  failAreaBackendTicketReward,
  finalizeAreaBackendTicketReward,
  reserveAreaBackendTicketReward,
} from "../../../server/crowdrelayArea"
import { ensureLegacyAreaImported } from "../../../server/areaMigration"
import {
  AreaTicketIssueError,
  areaTicketRewardConfigs,
  findAreaTicketReward,
  issueAreaTicket,
} from "../../../server/areaTicketRewards"
import {
  areaJson,
  isSameOriginRequest,
  readSmallJsonObject,
} from "../../../server/areaHttp"
import { normalizeAreaEmail } from "../../../server/areaAuth"

export const prerender = false

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EVENT_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/
const PROCESSING_LEASE_MS = 2 * 60 * 1_000

type ReservationResponse = {
  state: "acquired" | "busy" | "issued" | "failed" | "insufficient"
  reward?: {
    requestId: string
    eventSlug: string
    credits: number
    fanEmail: string
    status: "reserved" | "issued" | "failed"
    reservationId: string
    reservationExpiresAt: number
    publicReference?: string | null
    issuedAt?: string | null
  } | null
}

const reservationResponse = (value: unknown): ReservationResponse => {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid AREA ticket reservation response")
  }
  const result = value as Partial<ReservationResponse>
  if (![
    "acquired",
    "busy",
    "issued",
    "failed",
    "insufficient",
  ].includes(result.state ?? "")) {
    throw new Error("Invalid AREA ticket reservation state")
  }
  return result as ReservationResponse
}

const publicRewards = () =>
  areaTicketRewardConfigs().map(({ eventSlug, title, startsAt, credits }) => ({
    eventSlug,
    title,
    startsAt: startsAt ?? null,
    credits,
  }))

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const actor = await getAreaActor(cookies)
    if (!actor.authenticated || !actor.backendPlayerId) {
      return areaJson({ authenticated: false, rewards: publicRewards(), claims: [] })
    }
    const wallet = await ensureLegacyAreaImported(
      actor.backendPlayerId,
      actor.actorId,
      actor.browserWalletId,
    )
    const claims = wallet.ticketRewards
      .filter(reward => reward.status === "issued")
      .map(reward => ({
        eventSlug: reward.eventSlug,
        publicReference: reward.publicReference ?? null,
        issuedAt: reward.issuedAt ?? null,
      }))
    return areaJson({ authenticated: true, rewards: publicRewards(), claims })
  } catch (error) {
    console.error("[area-tickets:list]", error)
    return areaJson({ error: "Ticket rewards temporarily unavailable" }, 503)
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }
  let body: Record<string, unknown>
  try {
    body = await readSmallJsonObject(request)
  } catch {
    return areaJson({ error: "Invalid request" }, 400)
  }
  const requestId =
    typeof body.requestId === "string" ? body.requestId.toLowerCase() : ""
  const eventSlug =
    typeof body.eventSlug === "string" ? body.eventSlug.trim().toLowerCase() : ""
  const email = normalizeAreaEmail(body.email)
  const lang = body.lang === "pl" ? "pl" : "en"
  if (
    !REQUEST_ID_PATTERN.test(requestId) ||
    !EVENT_SLUG_PATTERN.test(eventSlug) ||
    !email
  ) {
    return areaJson({ error: "Invalid ticket reward request" }, 400)
  }
  const configured = findAreaTicketReward(eventSlug)
  if (!configured) return areaJson({ error: "Ticket reward unavailable" }, 404)

  try {
    const actor = await getAreaActor(cookies)
    if (!actor.authenticated || !actor.backendPlayerId) {
      return areaJson(
        { error: "Player profile required", code: "AUTH_REQUIRED" },
        401,
      )
    }
    await ensureLegacyAreaImported(
      actor.backendPlayerId,
      actor.actorId,
      actor.browserWalletId,
    )

    const reservationId = randomBytes(16).toString("hex")
    const reservation = reservationResponse(
      await reserveAreaBackendTicketReward(actor.backendPlayerId, {
        requestId,
        eventSlug,
        credits: configured.credits,
        fanEmail: email,
        reservationId,
        reservationExpiresAt: Date.now() + PROCESSING_LEASE_MS,
      }),
    )
    if (reservation.state === "insufficient") {
      return areaJson(
        { error: "Not enough VIRYA Credits", code: "INSUFFICIENT_CREDITS" },
        409,
      )
    }
    if (reservation.state === "busy") {
      return areaJson(
        { error: "Ticket reward is still processing", code: "REWARD_PENDING" },
        409,
      )
    }
    if (reservation.state === "failed") {
      return areaJson(
        { error: "Create a new ticket reward request", code: "REWARD_FAILED" },
        409,
      )
    }
    if (!reservation.reward) throw new Error("Missing ticket reward reservation")

    let issued
    try {
      issued = await issueAreaTicket({
        accountId: actor.accountId,
        event: configured,
        email: reservation.reward.fanEmail,
        requestId,
      })
    } catch (error) {
      const status = error instanceof AreaTicketIssueError ? error.status : 503
      const permanent = [400, 404, 409, 422].includes(status)
      if (reservation.state === "acquired") {
        await failAreaBackendTicketReward(actor.backendPlayerId, {
          requestId,
          reservationId: reservation.reward.reservationId,
          permanent,
          failureCode: permanent ? `crowdrelay_${status}` : undefined,
        })
      }
      if (permanent) {
        return areaJson(
          {
            error:
              status === 404
                ? "Join Virya Signal with this e-mail before claiming the ticket"
                : "This ticket reward is no longer available",
            code: status === 404 ? "SIGNAL_REQUIRED" : "TICKET_UNAVAILABLE",
          },
          status === 404 ? 422 : 409,
        )
      }
      return areaJson(
        { error: "Ticket reward temporarily unavailable", code: "REWARD_RETRY" },
        503,
      )
    }

    if (reservation.state === "acquired") {
      await finalizeAreaBackendTicketReward(actor.backendPlayerId, {
        requestId,
        reservationId: reservation.reward.reservationId,
        publicReference: issued.publicReference,
      })
    }

    const prefix = lang === "pl" ? "/pl" : ""
    return areaJson({
      ok: true,
      publicReference: issued.publicReference,
      winnerUrl: `${prefix}/win#token=${encodeURIComponent(issued.claimToken)}`,
      claimExpiresAt: issued.claimExpiresAt,
    })
  } catch (error) {
    if (error instanceof CrowdRelayAreaError) {
      return areaJson(error.body, error.status)
    }
    console.error("[area-tickets:claim]", error)
    return areaJson({ error: "Ticket reward temporarily unavailable" }, 503)
  }
}
