import { readServerEnv } from "./runtimeEnv.ts"
import { resolvePublicDrawProof } from "../data/drawProofs.ts"
import { readLimitedJson } from "./readLimitedJson.ts"

const DEFAULT_BASE_URL = "https://signal-api.virya.music/v1/"
const ALLOWED_STATUS = new Set(["draft", "scheduled", "running", "completed", "cancelled"])
const ALLOWED_ANCHOR_STATUS = new Set(["queued", "processing", "confirmed", "failed", "dead"])
const STATUS_RESPONSE_BYTES = 64 * 1024
const PROOF_RESPONSE_BYTES = 1024 * 1024
const SHA256 = /^[0-9a-f]{64}$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type PublicDrawStatus = {
  schema: "crowdrelay/draw-status/v1"
  draw_slug: string
  draw_name: string
  status: "draft" | "scheduled" | "running" | "completed" | "cancelled"
  draw_at: string
  completed_at: string | null
  proof_available: boolean
}

export type PublicDrawAnchor = {
  batch_id: string
  status: "queued" | "processing" | "confirmed" | "failed" | "dead"
  anchor_kind: string | null
  anchor_url: string | null
  entry_id: string | null
  sequence: number | null
  integrated_at: string | null
  signer_fingerprint: string | null
}

export type PublicDrawProof = {
  schema: "crowdrelay/draw-receipt/v1"
  draw_slug: string
  draw_name: string
  run_id: string
  algorithm_version: string
  seed_hash_sha256: string
  revealed_seed_hex: string
  eligible_count: number
  total_entries: number
  requested_winners: number
  selected_winners: number
  candidate_snapshot_sha256: string
  winner_snapshot_sha256: string
  receipt_sha256: string
  locally_verified: boolean
  anchor: PublicDrawAnchor
  completed_at: string
}

export type PublicDrawProofState =
  | { kind: "not_found"; drawSlug: string }
  | { kind: "unavailable"; drawSlug: string }
  | { kind: "scheduled" | "running" | "cancelled" | "completed_pending"; status: PublicDrawStatus }
  | { kind: "proof_unavailable"; status: PublicDrawStatus }
  | { kind: "ready"; status: PublicDrawStatus; proof: PublicDrawProof }

function apiBase() {
  const configured =
    readServerEnv("PUBLIC_CROWDRELAY_API_URL", import.meta.env.PUBLIC_CROWDRELAY_API_URL)?.trim() ||
    DEFAULT_BASE_URL
  const url = new URL(configured)
  const localHttp = import.meta.env.DEV && url.protocol === "http:"
  if ((url.protocol !== "https:" && !localHttp) || url.username || url.password) {
    throw new Error("Invalid CrowdRelay proof API URL")
  }
  url.search = ""
  url.hash = ""
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
  return url
}

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/

const boundedString = (value: unknown, max: number) =>
  typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null

const optionalBoundedString = (value: unknown, max: number) =>
  value === null || value === undefined ? null : boundedString(value, max)

const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 64 &&
  RFC3339.test(value) &&
  Number.isFinite(Date.parse(value))

function parseStatus(value: unknown): PublicDrawStatus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (raw.schema !== "crowdrelay/draw-status/v1") return null
  const drawSlug = boundedString(raw.draw_slug, 128)
  const drawName = boundedString(raw.draw_name, 300)
  const status = boundedString(raw.status, 32)
  if (!drawSlug || !drawName || !status || !ALLOWED_STATUS.has(status)) return null
  const drawAt = raw.draw_at
  const completedAt = raw.completed_at
  const proofAvailable = raw.proof_available
  if (!validTimestamp(drawAt)) return null
  if (completedAt !== null && completedAt !== undefined && !validTimestamp(completedAt)) return null
  if (typeof proofAvailable !== "boolean") return null
  return {
    schema: "crowdrelay/draw-status/v1",
    draw_slug: drawSlug,
    draw_name: drawName,
    status: status as PublicDrawStatus["status"],
    draw_at: drawAt,
    completed_at: completedAt ?? null,
    proof_available: proofAvailable,
  }
}

const nonNegativeInteger = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max

export function parsePublicDrawProof(value: unknown): PublicDrawProof | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (raw.schema !== "crowdrelay/draw-receipt/v1") return null

  const drawSlug = boundedString(raw.draw_slug, 128)
  const drawName = boundedString(raw.draw_name, 300)
  const runId = boundedString(raw.run_id, 64)
  const algorithmVersion = boundedString(raw.algorithm_version, 128)
  const seedHash = boundedString(raw.seed_hash_sha256, 64)
  const revealedSeed = boundedString(raw.revealed_seed_hex, 512)
  const candidateHash = boundedString(raw.candidate_snapshot_sha256, 64)
  const winnerHash = boundedString(raw.winner_snapshot_sha256, 64)
  const receiptHash = boundedString(raw.receipt_sha256, 64)
  if (!drawSlug || !drawName || !runId || !UUID.test(runId) || !algorithmVersion) return null
  if (!seedHash || !SHA256.test(seedHash) || !revealedSeed || revealedSeed.length !== 64 || !SHA256.test(revealedSeed)) return null
  if (!candidateHash || !SHA256.test(candidateHash) || !winnerHash || !SHA256.test(winnerHash) || !receiptHash || !SHA256.test(receiptHash)) return null
  const eligibleCount = raw.eligible_count
  const totalEntries = raw.total_entries
  const requestedWinners = raw.requested_winners
  const selectedWinners = raw.selected_winners
  const completedAt = raw.completed_at
  if (!nonNegativeInteger(eligibleCount, 10_000_000) || !nonNegativeInteger(totalEntries, 1_000_000_000)) return null
  if (!nonNegativeInteger(requestedWinners, 100_000) || !nonNegativeInteger(selectedWinners, 100_000)) return null
  if (selectedWinners > requestedWinners || selectedWinners > eligibleCount) return null
  if (typeof raw.locally_verified !== "boolean" || !validTimestamp(completedAt)) return null

  if (!raw.anchor || typeof raw.anchor !== "object" || Array.isArray(raw.anchor)) return null
  const anchor = raw.anchor as Record<string, unknown>
  const batchId = boundedString(anchor.batch_id, 64)
  const anchorStatus = boundedString(anchor.status, 32)
  const anchorKind = optionalBoundedString(anchor.anchor_kind, 128)
  const anchorUrl = optionalBoundedString(anchor.anchor_url, 2048)
  const entryId = optionalBoundedString(anchor.entry_id, 256)
  const signerFingerprint = optionalBoundedString(anchor.signer_fingerprint, 512)
  if (!batchId || !UUID.test(batchId) || !anchorStatus || !ALLOWED_ANCHOR_STATUS.has(anchorStatus)) return null
  if (anchor.anchor_kind !== null && anchor.anchor_kind !== undefined && anchorKind === null) return null
  if (anchor.anchor_url !== null && anchor.anchor_url !== undefined && anchorUrl === null) return null
  if (anchor.entry_id !== null && anchor.entry_id !== undefined && entryId === null) return null
  if (anchor.signer_fingerprint !== null && anchor.signer_fingerprint !== undefined && signerFingerprint === null) return null
  const sequence = anchor.sequence
  const integratedAt = anchor.integrated_at
  if (sequence !== null && sequence !== undefined && !nonNegativeInteger(sequence)) return null
  if (integratedAt !== null && integratedAt !== undefined && !validTimestamp(integratedAt)) return null

  return {
    schema: "crowdrelay/draw-receipt/v1",
    draw_slug: drawSlug,
    draw_name: drawName,
    run_id: runId,
    algorithm_version: algorithmVersion,
    seed_hash_sha256: seedHash,
    revealed_seed_hex: revealedSeed,
    eligible_count: eligibleCount,
    total_entries: totalEntries,
    requested_winners: requestedWinners,
    selected_winners: selectedWinners,
    candidate_snapshot_sha256: candidateHash,
    winner_snapshot_sha256: winnerHash,
    receipt_sha256: receiptHash,
    locally_verified: raw.locally_verified,
    anchor: {
      batch_id: batchId,
      status: anchorStatus as PublicDrawAnchor["status"],
      anchor_kind: anchorKind,
      anchor_url: anchorUrl,
      entry_id: entryId,
      sequence: sequence ?? null,
      integrated_at: integratedAt ?? null,
      signer_fingerprint: signerFingerprint,
    },
    completed_at: completedAt,
  }
}



export async function loadPublicDrawProofState(slug: string): Promise<PublicDrawProofState> {
  const drawRef = resolvePublicDrawProof(slug)
  let base: URL
  try {
    base = apiBase()
  } catch {
    return { kind: "unavailable", drawSlug: drawRef.drawSlug }
  }
  let statusResponse: Response
  try {
    statusResponse = await fetch(
      new URL(`public/proofs/draws/${encodeURIComponent(drawRef.drawSlug)}/status`, base),
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      },
    )
  } catch {
    return { kind: "unavailable", drawSlug: drawRef.drawSlug }
  }

  if (statusResponse.status === 404) return { kind: "not_found", drawSlug: drawRef.drawSlug }
  if (!statusResponse.ok) return { kind: "unavailable", drawSlug: drawRef.drawSlug }

  let status: PublicDrawStatus | null = null
  try {
    status = parseStatus(await readLimitedJson<unknown>(statusResponse, STATUS_RESPONSE_BYTES))
  } catch {
    status = null
  }
  if (!status || status.draw_slug !== drawRef.drawSlug) {
    return { kind: "unavailable", drawSlug: drawRef.drawSlug }
  }

  if (status.status === "cancelled") return { kind: "cancelled", status }
  if (status.status === "running") return { kind: "running", status }
  if (status.status === "draft" || status.status === "scheduled") return { kind: "scheduled", status }
  if (!status.proof_available) return { kind: "completed_pending", status }

  let proofResponse: Response
  try {
    proofResponse = await fetch(new URL(`public/proofs/draws/${encodeURIComponent(drawRef.drawSlug)}`, base), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    return { kind: "proof_unavailable", status }
  }
  if (proofResponse.status === 404) return { kind: "completed_pending", status }
  if (!proofResponse.ok) return { kind: "proof_unavailable", status }

  try {
    const proof = parsePublicDrawProof(await readLimitedJson<unknown>(proofResponse, PROOF_RESPONSE_BYTES))
    if (!proof || proof.draw_slug !== status.draw_slug) {
      return { kind: "proof_unavailable", status }
    }
    return { kind: "ready", status, proof }
  } catch {
    return { kind: "proof_unavailable", status }
  }
}
