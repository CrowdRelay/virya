import { randomBytes } from "node:crypto"
import type { APIRoute } from "astro"
import { getAreaActor } from "../../../server/areaActor"
import {
  getAreaWallet,
  mutateAreaWallet,
  type AreaTicketReward,
} from "../../../server/areaLedger"
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
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const EVENT_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/
const PROCESSING_LEASE_MS = 2 * 60 * 1_000

type Reservation = {
  reward: AreaTicketReward | null
  state: "acquired" | "busy" | "issued" | "failed" | "insufficient"
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
    if (!actor.authenticated) {
      return areaJson({ authenticated: false, rewards: publicRewards(), claims: [] })
    }
    const wallet = await getAreaWallet(actor.actorId)
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
  const requestId = typeof body.requestId === "string"
    ? body.requestId.toLowerCase()
    : ""
  const eventSlug = typeof body.eventSlug === "string"
    ? body.eventSlug.trim().toLowerCase()
    : ""
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
    if (!actor.authenticated) {
      return areaJson({ error: "Player profile required", code: "AUTH_REQUIRED" }, 401)
    }
    const processingId = randomBytes(16).toString("hex")
    const reservation = await mutateAreaWallet<Reservation>(
      actor.actorId,
      wallet => {
        const existingIssued = wallet.ticketRewards.find(
          reward => reward.eventSlug === eventSlug && reward.status === "issued",
        )
        if (existingIssued) {
          return { wallet, result: { reward: existingIssued, state: "issued" } }
        }
        const existingIndex = wallet.ticketRewards.findIndex(
          reward => reward.requestId === requestId,
        )
        const existing = existingIndex >= 0
          ? wallet.ticketRewards[existingIndex]
          : undefined
        if (existing?.status === "failed") {
          return { wallet, result: { reward: existing, state: "failed" } }
        }
        if (existing?.status === "pending") {
          if (Number(existing.processingExpiresAt) > Date.now()) {
            return { wallet, result: { reward: existing, state: "busy" } }
          }
          const resumed: AreaTicketReward = {
            ...existing,
            processingId,
            processingExpiresAt: Date.now() + PROCESSING_LEASE_MS,
          }
          const ticketRewards = [...wallet.ticketRewards]
          ticketRewards[existingIndex] = resumed
          return {
            wallet: { ...wallet, ticketRewards },
            result: { reward: resumed, state: "acquired" },
          }
        }
        const anotherPendingIndex = wallet.ticketRewards.findIndex(
          reward => reward.eventSlug === eventSlug && reward.status === "pending",
        )
        if (anotherPendingIndex >= 0) {
          const anotherPending = wallet.ticketRewards[anotherPendingIndex]
          if (
            anotherPending &&
            Number(anotherPending.processingExpiresAt) > Date.now()
          ) {
            return { wallet, result: { reward: anotherPending, state: "busy" } }
          }
          if (anotherPending) {
            const resumed: AreaTicketReward = {
              ...anotherPending,
              requestId,
              fanEmail: email,
              processingId,
              processingExpiresAt: Date.now() + PROCESSING_LEASE_MS,
              failureCode: undefined,
            }
            const ticketRewards = [...wallet.ticketRewards]
            ticketRewards[anotherPendingIndex] = resumed
            return {
              wallet: { ...wallet, ticketRewards },
              result: { reward: resumed, state: "acquired" },
            }
          }
        }
        if (wallet.tokenBalance < configured.credits) {
          return { wallet, result: { reward: null, state: "insufficient" } }
        }
        const reward: AreaTicketReward = {
          requestId,
          eventSlug,
          credits: configured.credits,
          fanEmail: email,
          status: "pending",
          createdAt: new Date().toISOString(),
          processingId,
          processingExpiresAt: Date.now() + PROCESSING_LEASE_MS,
        }
        return {
          wallet: {
            ...wallet,
            tokenBalance: wallet.tokenBalance - configured.credits,
            ticketRewards: [...wallet.ticketRewards, reward],
          },
          result: { reward, state: "acquired" },
        }
      },
    )

    if (reservation.state === "insufficient") {
      return areaJson({ error: "Not enough VIRYA Credits", code: "INSUFFICIENT_CREDITS" }, 409)
    }
    if (reservation.state === "busy") {
      return areaJson({ error: "Ticket reward is still processing", code: "REWARD_PENDING" }, 409)
    }
    if (reservation.state === "failed") {
      return areaJson({ error: "Create a new ticket reward request", code: "REWARD_FAILED" }, 409)
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
      if (reservation.state === "acquired") await mutateAreaWallet(actor.actorId, wallet => {
        let refund = 0
        const ticketRewards = wallet.ticketRewards.map(reward => {
          if (
            reward.requestId !== requestId ||
            reward.status !== "pending" ||
            reward.processingId !== processingId
          ) return reward
          if (permanent) refund = reward.credits
          return {
            ...reward,
            status: permanent ? "failed" as const : "pending" as const,
            processingId: undefined,
            processingExpiresAt: undefined,
            failureCode: permanent ? `crowdrelay_${status}` : undefined,
          }
        })
        return {
          wallet: {
            ...wallet,
            tokenBalance: wallet.tokenBalance + refund,
            ticketRewards,
          },
          result: null,
        }
      })
      if (permanent) {
        return areaJson(
          {
            error: status === 404
              ? "Join Virya Signal with this e-mail before claiming the ticket"
              : "This ticket reward is no longer available",
            code: status === 404 ? "SIGNAL_REQUIRED" : "TICKET_UNAVAILABLE",
          },
          status === 404 ? 422 : 409,
        )
      }
      return areaJson({ error: "Ticket reward temporarily unavailable", code: "REWARD_RETRY" }, 503)
    }

    if (reservation.state === "acquired") await mutateAreaWallet(actor.actorId, wallet => {
      const ticketRewards = wallet.ticketRewards.map(reward =>
        reward.requestId === requestId &&
        reward.status === "pending" &&
        reward.processingId === processingId
          ? {
              ...reward,
              status: "issued" as const,
              processingId: undefined,
              processingExpiresAt: undefined,
              publicReference: issued.publicReference,
              issuedAt: new Date().toISOString(),
              failureCode: undefined,
            }
          : reward,
      )
      return { wallet: { ...wallet, ticketRewards }, result: null }
    })

    const prefix = lang === "pl" ? "/pl" : ""
    return areaJson({
      ok: true,
      publicReference: issued.publicReference,
      winnerUrl: `${prefix}/win#token=${encodeURIComponent(issued.claimToken)}`,
      claimExpiresAt: issued.claimExpiresAt,
    })
  } catch (error) {
    console.error("[area-tickets:claim]", error)
    return areaJson({ error: "Ticket reward temporarily unavailable" }, 503)
  }
}
