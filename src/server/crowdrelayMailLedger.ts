import { createHash, randomUUID } from "node:crypto"
import { getStore } from "@netlify/blobs"

const STORE_NAME = "virya-crowdrelay-mail-deliveries"
const LEASE_MS = 75 * 1_000
const MAX_CAS_ATTEMPTS = 6

type DeliveryRecord = {
  version: 1
  status: "processing" | "done" | "ambiguous"
  leaseId: string
  expiresAt: number
  updatedAt: string
  template: string
  recipient: string
  providerReference?: string
  errorKind?: string
}

export type CrowdRelayMailLease =
  | { status: "acquired"; leaseId: string }
  | { status: "busy" | "done" | "ambiguous"; providerReference?: string }

const store = () => getStore({ name: STORE_NAME, consistency: "strong" })
const recordKey = (idempotencyKey: string) =>
  `events/${createHash("sha256").update(idempotencyKey).digest("hex")}`

const normalize = (value: unknown): DeliveryRecord | null => {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<DeliveryRecord>
  if (
    record.version !== 1 ||
    (record.status !== "processing" && record.status !== "done" && record.status !== "ambiguous") ||
    typeof record.leaseId !== "string" ||
    typeof record.template !== "string" ||
    typeof record.recipient !== "string" ||
    !Number.isFinite(Number(record.expiresAt))
  ) {
    return null
  }
  return {
    version: 1,
    status: record.status,
    leaseId: record.leaseId,
    expiresAt: Number(record.expiresAt),
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date(0).toISOString(),
    template: record.template,
    recipient: record.recipient,
    ...(typeof record.providerReference === "string" ? { providerReference: record.providerReference } : {}),
    ...(typeof record.errorKind === "string" ? { errorKind: record.errorKind } : {}),
  }
}

export const acquireCrowdRelayMailLease = async (
  idempotencyKey: string,
  template: string,
  recipient: string,
): Promise<CrowdRelayMailLease> => {
  const key = recordKey(idempotencyKey)
  const leaseId = randomUUID()

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await store().getWithMetadata(key, {
      type: "json",
      consistency: "strong",
    })
    const record = normalize(current?.data)
    if (record?.status === "done") return { status: "done", ...(record.providerReference ? { providerReference: record.providerReference } : {}) }
    if (record?.status === "ambiguous") return { status: "ambiguous", ...(record.providerReference ? { providerReference: record.providerReference } : {}) }
    if (record?.status === "processing" && record.expiresAt > Date.now()) {
      return { status: "busy" }
    }

    const next: DeliveryRecord = {
      version: 1,
      status: "processing",
      leaseId,
      expiresAt: Date.now() + LEASE_MS,
      updatedAt: new Date().toISOString(),
      template,
      recipient,
    }
    const write = await store().setJSON(
      key,
      next,
      current ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
    )
    if (write.modified) return { status: "acquired", leaseId }
  }

  throw new Error("CrowdRelay mail lease is busy; retry")
}

const transition = async (
  idempotencyKey: string,
  leaseId: string,
  status: "processing" | "done" | "ambiguous",
  details: { providerReference?: string; errorKind?: string } = {},
) => {
  const key = recordKey(idempotencyKey)
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await store().getWithMetadata(key, {
      type: "json",
      consistency: "strong",
    })
    const record = normalize(current?.data)
    if (record?.status === "done" || record?.status === "ambiguous") return
    if (!current || !record || record.leaseId !== leaseId) {
      throw new Error("CrowdRelay mail lease ownership was lost")
    }
    const next: DeliveryRecord = {
      ...record,
      status,
      expiresAt: status === "processing" ? Date.now() - 1 : 0,
      updatedAt: new Date().toISOString(),
      ...(details.providerReference ? { providerReference: details.providerReference.slice(0, 240) } : {}),
      ...(details.errorKind ? { errorKind: details.errorKind.slice(0, 120) } : {}),
    }
    const write = await store().setJSON(key, next, {
      onlyIfMatch: current.etag,
    })
    if (write.modified) return
  }
  throw new Error("CrowdRelay mail lease transition is busy; retry")
}

export const completeCrowdRelayMailLease = (
  idempotencyKey: string,
  leaseId: string,
  providerReference?: string,
) => transition(idempotencyKey, leaseId, "done", { providerReference })

/**
 * Provider execution started but its final acceptance could not be proven.
 * This is terminal by design: automatic retries could duplicate an email when
 * SMTP/HTTP accepted the message but the response was lost.
 */
export const markCrowdRelayMailAmbiguous = (
  idempotencyKey: string,
  leaseId: string,
  errorKind = "provider_outcome_unknown",
) => transition(idempotencyKey, leaseId, "ambiguous", { errorKind })

/** Safe only before any provider side effect starts. */
export const releaseCrowdRelayMailLease = (
  idempotencyKey: string,
  leaseId: string,
) => transition(idempotencyKey, leaseId, "processing")
