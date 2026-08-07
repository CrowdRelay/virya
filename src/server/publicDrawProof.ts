import { resolvePublicDrawProof } from "../data/drawProofs"

const DEFAULT_BASE_URL = "https://signal-api.virya.music/v1/"
const ALLOWED_STATUS = new Set(["draft", "scheduled", "running", "completed", "cancelled"])

export type PublicDrawStatus = {
  schema: "crowdrelay/draw-status/v1"
  draw_slug: string
  draw_name: string
  status: "draft" | "scheduled" | "running" | "completed" | "cancelled"
  draw_at: string
  completed_at: string | null
  proof_available: boolean
}

export type PublicDrawProofState =
  | { kind: "not_found"; drawSlug: string }
  | { kind: "unavailable"; drawSlug: string }
  | { kind: "scheduled" | "running" | "cancelled" | "completed_pending"; status: PublicDrawStatus }
  | { kind: "proof_unavailable"; status: PublicDrawStatus }
  | { kind: "ready"; status: PublicDrawStatus; proof: Record<string, any> }

function apiBase() {
  const configured = import.meta.env.PUBLIC_CROWDRELAY_API_URL?.trim() || DEFAULT_BASE_URL
  return configured.endsWith("/") ? configured : `${configured}/`
}

function parseStatus(value: unknown): PublicDrawStatus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (raw.schema !== "crowdrelay/draw-status/v1") return null
  if (typeof raw.draw_slug !== "string" || typeof raw.draw_name !== "string") return null
  if (typeof raw.status !== "string" || !ALLOWED_STATUS.has(raw.status)) return null
  if (typeof raw.draw_at !== "string" || !Number.isFinite(Date.parse(raw.draw_at))) return null
  if (raw.completed_at !== null && raw.completed_at !== undefined) {
    if (typeof raw.completed_at !== "string" || !Number.isFinite(Date.parse(raw.completed_at))) return null
  }
  if (typeof raw.proof_available !== "boolean") return null
  return raw as PublicDrawStatus
}

async function readJson(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get("content-length") ?? "0")
  if (Number.isFinite(contentLength) && contentLength > 1_000_000) throw new Error("response too large")
  return response.json()
}

export async function loadPublicDrawProofState(slug: string): Promise<PublicDrawProofState> {
  const drawRef = resolvePublicDrawProof(slug)
  const base = apiBase()
  let statusResponse: Response
  try {
    statusResponse = await fetch(
      `${base}public/proofs/draws/${encodeURIComponent(drawRef.drawSlug)}/status`,
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
    status = parseStatus(await readJson(statusResponse))
  } catch {
    status = null
  }
  if (!status) return { kind: "unavailable", drawSlug: drawRef.drawSlug }

  if (status.status === "cancelled") return { kind: "cancelled", status }
  if (status.status === "running") return { kind: "running", status }
  if (status.status === "draft" || status.status === "scheduled") return { kind: "scheduled", status }
  if (!status.proof_available) return { kind: "completed_pending", status }

  let proofResponse: Response
  try {
    proofResponse = await fetch(`${base}public/proofs/draws/${encodeURIComponent(drawRef.drawSlug)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    return { kind: "proof_unavailable", status }
  }
  if (proofResponse.status === 404) return { kind: "completed_pending", status }
  if (!proofResponse.ok) return { kind: "proof_unavailable", status }

  try {
    const proof = await readJson(proofResponse)
    if (!proof || typeof proof !== "object" || Array.isArray(proof)) {
      return { kind: "proof_unavailable", status }
    }
    return { kind: "ready", status, proof: proof as Record<string, any> }
  } catch {
    return { kind: "proof_unavailable", status }
  }
}
