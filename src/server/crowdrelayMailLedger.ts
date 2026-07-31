import { createHash, randomUUID } from "node:crypto"
import { getStore } from "@netlify/blobs"

const STORE_NAME = "virya-crowdrelay-mail-deliveries"
const LEASE_MS = 5 * 60 * 1_000
const MAX_CAS_ATTEMPTS = 6

type DeliveryRecord = {
  version: 1
  status: "processing" | "done"
  leaseId: string
  expiresAt: number
  updatedAt: string
  template: string
  recipient: string
}

export type CrowdRelayMailLease =
  | { status: "acquired"; leaseId: string }
  | { status: "busy" | "done" }

const store = () => getStore({ name: STORE_NAME, consistency: "strong" })
const recordKey = (idempotencyKey: string) =>
  `events/${createHash("sha256").update(idempotencyKey).digest("hex")}`

const normalize = (value: unknown): DeliveryRecord | null => {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<DeliveryRecord>
  if (
    record.version !== 1 ||
    (record.status !== "processing" && record.status !== "done") ||
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
    if (record?.status === "done") return { status: "done" }
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
  status: "processing" | "done",
) => {
  const key = recordKey(idempotencyKey)
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await store().getWithMetadata(key, {
      type: "json",
      consistency: "strong",
    })
    const record = normalize(current?.data)
    if (record?.status === "done") return
    if (!current || !record || record.leaseId !== leaseId) {
      throw new Error("CrowdRelay mail lease ownership was lost")
    }
    const next: DeliveryRecord = {
      ...record,
      status,
      expiresAt: status === "done" ? 0 : Date.now() - 1,
      updatedAt: new Date().toISOString(),
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
) => transition(idempotencyKey, leaseId, "done")

export const releaseCrowdRelayMailLease = (
  idempotencyKey: string,
  leaseId: string,
) => transition(idempotencyKey, leaseId, "processing")
