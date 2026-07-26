import type { APIRoute } from "astro"
import { timingSafeEqual } from "node:crypto"
import { getAreaDrop } from "../../../data/area"
import { getCollectible, getLiveDrop, getPublicCollectible } from "../../../server/areaCatalog"
import { mutateAreaWallet, reserveAreaDropClaim } from "../../../server/areaLedger"
import {
  areaJson,
  getAreaWalletId,
  isSameOriginRequest,
  readSmallJson,
} from "../../../server/areaHttp"

export const prerender = false

const MAX_ACCURACY_METERS = 150
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 8

const validCoordinate = (value: unknown, min: number, max: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
}

const secretsMatch = (provided: string, expected: string) => {
  const left = Buffer.from(provided)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

const toRadians = (value: number) => (value * Math.PI) / 180

const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const earthRadius = 6_371_000
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }

  let body: any
  try {
    body = await readSmallJson(request)
  } catch {
    return areaJson({ error: "Invalid request", code: "INVALID_REQUEST" }, 400)
  }

  const dropId = typeof body?.dropId === "string" ? body.dropId : ""
  const key = typeof body?.key === "string" ? body.key : ""
  const lat = Number(body?.lat)
  const lng = Number(body?.lng)
  const accuracy = Number(body?.accuracy)

  if (
    !getAreaDrop(dropId) ||
    key.length < 1 ||
    key.length > 256 ||
    !validCoordinate(lat, -90, 90) ||
    !validCoordinate(lng, -180, 180) ||
    !Number.isFinite(accuracy) ||
    accuracy < 0
  ) {
    return areaJson(
      { error: "Invalid claim data", code: "INVALID_REQUEST" },
      400
    )
  }

  const walletId = getAreaWalletId(cookies)

  try {
    const attempt = await mutateAreaWallet(walletId, (wallet) => {
      const now = Date.now()
      const attempts = wallet.attempts.filter(
        (timestamp) => timestamp > now - ATTEMPT_WINDOW_MS
      )
      const allowed = attempts.length < MAX_ATTEMPTS
      if (allowed) attempts.push(now)
      return {
        wallet: { ...wallet, attempts },
        result: { allowed },
      }
    })

    if (!attempt.allowed) {
      return areaJson(
        {
          error: "Too many attempts. Try again in a few minutes.",
          code: "RATE_LIMITED",
        },
        429
      )
    }

    const liveDrop = getLiveDrop(dropId)
    if (!liveDrop || !getCollectible(dropId)) {
      return areaJson(
        { error: "This drop is not live.", code: "DROP_INACTIVE" },
        409
      )
    }

    if (!secretsMatch(key, liveDrop.secret)) {
      return areaJson(
        { error: "The box code is not valid.", code: "INVALID_CODE" },
        403
      )
    }

    if (accuracy > MAX_ACCURACY_METERS) {
      return areaJson(
        {
          error: "Location is not accurate enough. Move outdoors and retry.",
          code: "LOW_ACCURACY",
        },
        422
      )
    }

    const distance = distanceMeters(lat, lng, liveDrop.lat, liveDrop.lng)
    const allowedDistance =
      liveDrop.radiusMeters + Math.min(accuracy, 50)

    if (distance > allowedDistance) {
      return areaJson(
        {
          error: "You are outside the drop zone.",
          code: "OUTSIDE_ZONE",
          distanceMeters: Math.round(distance),
        },
        422
      )
    }

    const capacity = await reserveAreaDropClaim(
      dropId,
      walletId,
      liveDrop.maxClaims
    )
    if (!capacity.reserved) {
      return areaJson(
        {
          error: "This drop has reached its claim limit.",
          code: "DROP_FULL",
        },
        409
      )
    }

    const claim = await mutateAreaWallet(walletId, (wallet) => {
      const existing = wallet.claims.find((item) => item.dropId === dropId)
      if (existing) {
        return {
          wallet,
          result: { alreadyClaimed: true, claim: existing },
        }
      }

      const nextClaim = {
        dropId,
        claimedAt: new Date().toISOString(),
        editionNumber: liveDrop.maxClaims - capacity.remaining,
        // Raw coordinates are deliberately not retained.
        distanceMeters: Math.round(distance),
      }

      return {
        wallet: {
          ...wallet,
          tokenBalance: wallet.tokenBalance + 1,
          claims: [...wallet.claims, nextClaim],
        },
        result: { alreadyClaimed: false, claim: nextClaim },
      }
    })

    return areaJson({
      ok: true,
      alreadyClaimed: claim.alreadyClaimed,
      collectible: getPublicCollectible(dropId),
      tokenAwarded: claim.alreadyClaimed ? 0 : 1,
    })
  } catch (error) {
    console.error("[area-claim]", error)
    return areaJson(
      { error: "Claim temporarily unavailable", code: "TEMPORARY" },
      503
    )
  }
}
