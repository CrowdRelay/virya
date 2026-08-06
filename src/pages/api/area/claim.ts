import type { APIRoute } from "astro"
import { getAreaDrop } from "../../../data/area"
import { getAreaMutationActor } from "../../../server/areaActor"
import {
  AREA_CHALLENGE_MAX_SAMPLES,
  AREA_CHALLENGE_MIN_DURATION_MS,
  AREA_CHALLENGE_MIN_SAMPLES,
  verifyAreaChallenge,
} from "../../../server/areaChallenge"
import {
  getCollectible,
  getLiveDrop,
  getPublicCollectible,
} from "../../../server/areaCatalog"
import {
  commitAreaDropClaim,
  mutateAreaWallet,
  releaseAreaDropClaim,
  reserveAreaDropClaim,
  type AreaClaim,
} from "../../../server/areaLedger"
import {
  areaJson,
  readSmallJsonObject,
} from "../../../server/areaHttp"

export const prerender = false

const MAX_ACCURACY_METERS = 60
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 8
const SAMPLE_CLOCK_TOLERANCE_MS = 3_000

type PositionSample = {
  lat: number
  lng: number
  accuracy: number
  capturedAt: number
}

const validCoordinate = (value: unknown, min: number, max: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
}

const parseSample = (value: unknown): PositionSample | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const sample = value as Record<string, unknown>
  const lat = Number(sample.lat)
  const lng = Number(sample.lng)
  const accuracy = Number(sample.accuracy)
  const capturedAt = Number(sample.capturedAt)
  if (
    !validCoordinate(lat, -90, 90) ||
    !validCoordinate(lng, -180, 180) ||
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    accuracy > 10_000 ||
    !Number.isInteger(capturedAt)
  ) {
    return null
  }
  return { lat, lng, accuracy, capturedAt }
}

const toRadians = (value: number) => (value * Math.PI) / 180

const distanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) => {
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

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const actor = await getAreaMutationActor(request, cookies)
  if (!actor) return areaJson({ error: "Invalid request origin" }, 403)

  let body: Record<string, unknown>
  try {
    body = await readSmallJsonObject(request)
  } catch {
    return areaJson({ error: "Invalid request", code: "INVALID_REQUEST" }, 400)
  }

  const dropId = typeof body.dropId === "string" ? body.dropId : ""
  const challenge = typeof body.challenge === "string" ? body.challenge : ""
  const rawSamples: unknown[] = Array.isArray(body.samples) ? body.samples : []
  const samples = rawSamples.map(parseSample)

  if (
    !getAreaDrop(dropId) ||
    challenge.length < 40 ||
    challenge.length > 2048 ||
    rawSamples.length < AREA_CHALLENGE_MIN_SAMPLES ||
    rawSamples.length > AREA_CHALLENGE_MAX_SAMPLES ||
    samples.some(sample => sample === null)
  ) {
    return areaJson(
      { error: "Invalid claim data", code: "INVALID_REQUEST" },
      400,
    )
  }

  try {
    if (!actor.authenticated) {
      return areaJson(
        { error: "Player profile required", code: "AUTH_REQUIRED" },
        401,
      )
    }

    const verifiedChallenge = verifyAreaChallenge(
      challenge,
      dropId,
      actor.actorId,
    )
    if (!verifiedChallenge) {
      return areaJson(
        { error: "Location challenge expired", code: "CHALLENGE_INVALID" },
        409,
      )
    }

    const attempt = await mutateAreaWallet(actor.actorId, wallet => {
      const now = Date.now()
      const attempts = wallet.attempts.filter(
        timestamp => timestamp > now - ATTEMPT_WINDOW_MS,
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
        429,
      )
    }

    const liveDrop = getLiveDrop(dropId)
    if (!liveDrop || !getCollectible(dropId)) {
      return areaJson(
        { error: "This drop is not live.", code: "DROP_INACTIVE" },
        409,
      )
    }

    const typedSamples = samples as PositionSample[]
    const now = Date.now()
    if (now - verifiedChallenge.iat < AREA_CHALLENGE_MIN_DURATION_MS) {
      return areaJson(
        {
          error: "Location verification finished too quickly.",
          code: "NOT_ENOUGH_SAMPLES",
        },
        422,
      )
    }

    const chronological = [...typedSamples].sort(
      (a, b) => a.capturedAt - b.capturedAt,
    )
    const first = chronological[0]
    const last = chronological[chronological.length - 1]
    const withinChallengeWindow = chronological.every(
      sample =>
        sample.capturedAt >=
          verifiedChallenge.iat - SAMPLE_CLOCK_TOLERANCE_MS &&
        sample.capturedAt <=
          Math.min(now + SAMPLE_CLOCK_TOLERANCE_MS, verifiedChallenge.exp),
    )
    if (
      !withinChallengeWindow ||
      last.capturedAt - first.capturedAt < AREA_CHALLENGE_MIN_DURATION_MS
    ) {
      return areaJson(
        {
          error: "Not enough fresh location samples.",
          code: "NOT_ENOUGH_SAMPLES",
        },
        422,
      )
    }

    const accurateSamples = chronological.filter(
      sample => sample.accuracy <= MAX_ACCURACY_METERS,
    )
    if (accurateSamples.length < AREA_CHALLENGE_MIN_SAMPLES) {
      return areaJson(
        {
          error: "Location is not accurate enough. Move outdoors and retry.",
          code: "LOW_ACCURACY",
        },
        422,
      )
    }

    const evaluated = accurateSamples.map(sample => {
      const distance = distanceMeters(
        sample.lat,
        sample.lng,
        liveDrop.lat,
        liveDrop.lng,
      )
      const tolerance = Math.min(sample.accuracy * 0.35, 15)
      return {
        ...sample,
        distance,
        allowedDistance: liveDrop.radiusMeters + tolerance,
      }
    })
    const inside = evaluated.filter(
      sample => sample.distance <= sample.allowedDistance,
    )
    const medianDistance = median(evaluated.map(sample => sample.distance))
    const medianAccuracy = median(evaluated.map(sample => sample.accuracy))
    const medianAllowedDistance =
      liveDrop.radiusMeters + Math.min(medianAccuracy * 0.35, 15)

    if (
      inside.length < AREA_CHALLENGE_MIN_SAMPLES ||
      medianDistance > medianAllowedDistance
    ) {
      return areaJson(
        {
          error: "You are outside the drop zone.",
          code: "OUTSIDE_ZONE",
        },
        422,
      )
    }

    const capacity = await reserveAreaDropClaim(
      dropId,
      actor.actorId,
      liveDrop.maxClaims,
    )
    if (!capacity.reserved) {
      return areaJson(
        {
          error: "This drop has reached its claim limit.",
          code: "DROP_FULL",
        },
        409,
      )
    }

    let claim: { alreadyClaimed: boolean; claim: AreaClaim }
    try {
      claim = await mutateAreaWallet<{
        alreadyClaimed: boolean
        claim: AreaClaim
      }>(actor.actorId, wallet => {
        const existing = wallet.claims.find(item => item.dropId === dropId)
        if (existing) {
          if (existing.editionNumber === capacity.editionNumber) {
            return {
              wallet,
              result: { alreadyClaimed: true, claim: existing },
            }
          }
          const reconciled = {
            ...existing,
            editionNumber: capacity.editionNumber,
          }
          return {
            wallet: {
              ...wallet,
              claims: wallet.claims.map(item =>
                item.dropId === dropId ? reconciled : item,
              ),
            },
            result: { alreadyClaimed: true, claim: reconciled },
          }
        }

        const nextClaim = {
          dropId,
          claimedAt: new Date().toISOString(),
          editionNumber: capacity.editionNumber,
          // Raw coordinates and individual samples are deliberately not retained.
          distanceMeters: Math.round(medianDistance),
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
    } catch (error) {
      try {
        await releaseAreaDropClaim(
          dropId,
          actor.actorId,
          capacity.leaseId,
          liveDrop.maxClaims,
        )
      } catch (releaseError) {
        console.error("[area-claim:release]", releaseError)
      }
      throw error
    }

    const committed = await commitAreaDropClaim(
      dropId,
      actor.actorId,
      capacity.leaseId,
      liveDrop.maxClaims,
    )
    if (!committed) {
      throw new Error("Area claim reservation could not be committed")
    }

    return areaJson({
      ok: true,
      alreadyClaimed: claim.alreadyClaimed,
      collectible: getPublicCollectible(dropId),
      rewardCreditsAwarded: claim.alreadyClaimed ? 0 : 1,
      tokenAwarded: claim.alreadyClaimed ? 0 : 1,
    })
  } catch (error) {
    console.error("[area-claim]", error)
    return areaJson(
      { error: "Claim temporarily unavailable", code: "TEMPORARY" },
      503,
    )
  }
}
