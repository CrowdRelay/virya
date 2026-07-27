import type { APIRoute } from "astro"
import { randomBytes } from "node:crypto"
import { getAreaActor } from "../../../server/areaActor"
import { mutateAreaWallet, type AreaVoucher } from "../../../server/areaLedger"
import {
  AREA_REWARD_BENEFIT,
  AREA_REWARD_LIFETIME_SECONDS,
  registerAreaRewardCode,
} from "../../../server/areaReward"
import {
  areaJson,
  isSameOriginRequest,
  readSmallJson,
} from "../../../server/areaHttp"

export const prerender = false

const PROCESSING_LEASE_MS = 2 * 60 * 1000
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const makeRewardCode = () => {
  const raw = randomBytes(12).toString("hex").toUpperCase()
  const groups = raw.match(/.{4}/g)
  if (!groups) throw new Error("Could not generate Area reward code")
  return `VIRYA-${groups.join("-")}`
}

const publicReward = (reward: AreaVoucher) => ({
  code: reward.code,
  tokens: reward.tokens,
  benefit: reward.benefit,
  createdAt: reward.createdAt,
  expiresAt: reward.expiresAt,
  status: reward.status,
  freeProductId: reward.freeProductId,
  freeProductLabel: reward.freeProductLabel,
  redeemedAt: reward.redeemedAt,
})

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }

  let body: any
  try {
    body = await readSmallJson(request)
  } catch {
    return areaJson({ error: "Invalid request" }, 400)
  }

  const tokens = Number(body?.tokens ?? 1)
  const requestId =
    typeof body?.requestId === "string" ? body.requestId.toLowerCase() : ""
  if (tokens !== 1 || !REQUEST_ID_PATTERN.test(requestId)) {
    return areaJson({ error: "Invalid reward request" }, 400)
  }

  try {
    const actor = await getAreaActor(cookies)
    if (!actor.authenticated) {
      return areaJson(
        { error: "Player profile required", code: "AUTH_REQUIRED" },
        401,
      )
    }

    const processingId = randomBytes(16).toString("hex")
    const processingExpiresAt = Date.now() + PROCESSING_LEASE_MS
    const expiresAt =
      Math.floor(Date.now() / 1000) + AREA_REWARD_LIFETIME_SECONDS
    const candidateCode = makeRewardCode()

    const reserved = await mutateAreaWallet<{
      reward: AreaVoucher | null
      insufficient: boolean
      ownsLease: boolean
    }>(actor.actorId, (wallet) => {
      const existingIndex = wallet.vouchers.findIndex(
        (reward) => reward.requestId === requestId,
      )
      const existing =
        existingIndex >= 0 ? wallet.vouchers[existingIndex] : undefined

      if (
        existing?.status === "issued" ||
        existing?.status === "reserved" ||
        existing?.status === "redeemed"
      ) {
        return {
          wallet,
          result: { reward: existing, insufficient: false, ownsLease: false },
        }
      }
      if (existing?.status === "failed") {
        return {
          wallet,
          result: { reward: existing, insufficient: false, ownsLease: false },
        }
      }
      if (existing?.status === "pending") {
        if (
          existing.processingId &&
          Number(existing.processingExpiresAt) > Date.now()
        ) {
          return {
            wallet,
            result: { reward: existing, insufficient: false, ownsLease: false },
          }
        }
        const resumed: AreaVoucher = {
          ...existing,
          processingId,
          processingExpiresAt,
        }
        const vouchers = [...wallet.vouchers]
        vouchers[existingIndex] = resumed
        return {
          wallet: { ...wallet, vouchers },
          result: { reward: resumed, insufficient: false, ownsLease: true },
        }
      }

      if (wallet.tokenBalance < 1) {
        return {
          wallet,
          result: { reward: null, insufficient: true, ownsLease: false },
        }
      }

      const reward: AreaVoucher = {
        requestId,
        code: candidateCode,
        tokens: 1,
        benefit: AREA_REWARD_BENEFIT,
        createdAt: new Date().toISOString(),
        expiresAt,
        status: "pending",
        processingId,
        processingExpiresAt,
      }
      return {
        wallet: {
          ...wallet,
          tokenBalance: wallet.tokenBalance - 1,
          vouchers: [...wallet.vouchers, reward],
        },
        result: { reward, insufficient: false, ownsLease: true },
      }
    })

    if (reserved.insufficient || !reserved.reward) {
      return areaJson(
        { error: "Not enough VIRYA Credits.", retryWithNewRequest: true },
        409,
      )
    }
    if (
      reserved.reward.status === "issued" ||
      reserved.reward.status === "reserved" ||
      reserved.reward.status === "redeemed"
    ) {
      return areaJson({ ok: true, reward: publicReward(reserved.reward) })
    }
    if (reserved.reward.status === "failed") {
      return areaJson(
        { error: "Create a new reward request.", retryWithNewRequest: true },
        409,
      )
    }
    if (!reserved.ownsLease) {
      return areaJson(
        {
          error: "This reward request is still processing. Try it again.",
          code: "VOUCHER_PENDING",
          retryWithNewRequest: false,
        },
        409,
      )
    }

    await registerAreaRewardCode({
      code: reserved.reward.code,
      ownerId: actor.actorId,
      requestId,
      issuedAt: reserved.reward.createdAt,
      expiresAt: reserved.reward.expiresAt,
    })

    const issued = await mutateAreaWallet<AreaVoucher | null>(
      actor.actorId,
      (wallet) => {
        let result: AreaVoucher | null = null
        const vouchers = wallet.vouchers.map((reward) => {
          if (
            reward.requestId === requestId &&
            reward.status === "issued"
          ) {
            result = reward
            return reward
          }
          if (
            reward.requestId !== requestId ||
            reward.status !== "pending" ||
            reward.processingId !== processingId
          ) {
            return reward
          }
          result = {
            ...reward,
            status: "issued",
            processingId: undefined,
            processingExpiresAt: undefined,
          }
          return result
        })
        return { wallet: { ...wallet, vouchers }, result }
      },
    )

    if (!issued) throw new Error("Area reward processing lease was lost")
    return areaJson({ ok: true, reward: publicReward(issued) })
  } catch (error) {
    console.error("[area-reward]", error)
    return areaJson(
      {
        error:
          "Could not finish the reward code. Retry the same request; your Credit remains reserved.",
        code: "VOUCHER_RETRY",
        retryWithNewRequest: false,
      },
      503,
    )
  }
}
