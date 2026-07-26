import { randomUUID } from "node:crypto"
import { getStore } from "@netlify/blobs"

type FulfillmentRecord = {
  version: 1
  status: "processing" | "done"
  leaseId: string
  expiresAt: number
  updatedAt: string
}

type FulfillmentLease =
  | { status: "acquired"; leaseId: string }
  | { status: "busy" | "done" }

const STORE_NAME = "virya-fulfillment"
const LEASE_MS = 10 * 60 * 1000
const MAX_CAS_ATTEMPTS = 6

const store = () => getStore({ name: STORE_NAME, consistency: "strong" })
const recordKey = (sessionId: string) => `checkout/${sessionId}`

const normalizeRecord = (value: unknown): FulfillmentRecord | null => {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<FulfillmentRecord>
  if (
    record.version !== 1 ||
    (record.status !== "processing" && record.status !== "done") ||
    typeof record.leaseId !== "string" ||
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
  }
}

export const acquireFulfillmentLease = async (
  sessionId: string
): Promise<FulfillmentLease> => {
  const key = recordKey(sessionId)
  const leaseId = randomUUID()

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await store().getWithMetadata(key, {
      type: "json",
      consistency: "strong",
    })
    const record = normalizeRecord(current?.data)
    if (record?.status === "done") return { status: "done" }
    if (record?.status === "processing" && record.expiresAt > Date.now()) {
      return { status: "busy" }
    }

    const next: FulfillmentRecord = {
      version: 1,
      status: "processing",
      leaseId,
      expiresAt: Date.now() + LEASE_MS,
      updatedAt: new Date().toISOString(),
    }
    const write = await store().setJSON(
      key,
      next,
      current ? { onlyIfMatch: current.etag } : { onlyIfNew: true }
    )
    if (write.modified) return { status: "acquired", leaseId }
  }

  throw new Error("Fulfillment lease is busy; retry")
}

const transitionFulfillmentLease = async (
  sessionId: string,
  leaseId: string,
  status: "processing" | "done"
) => {
  const key = recordKey(sessionId)

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await store().getWithMetadata(key, {
      type: "json",
      consistency: "strong",
    })
    const record = normalizeRecord(current?.data)
    if (record?.status === "done") return
    if (!current || record?.leaseId !== leaseId) {
      throw new Error("Fulfillment lease ownership was lost")
    }

    const write = await store().setJSON(
      key,
      {
        version: 1,
        status,
        leaseId,
        expiresAt: status === "done" ? 0 : Date.now() - 1,
        updatedAt: new Date().toISOString(),
      } satisfies FulfillmentRecord,
      { onlyIfMatch: current.etag }
    )
    if (write.modified) return
  }

  throw new Error("Fulfillment lease transition is busy; retry")
}

export const completeFulfillmentLease = (sessionId: string, leaseId: string) =>
  transitionFulfillmentLease(sessionId, leaseId, "done")

export const releaseFulfillmentLease = (sessionId: string, leaseId: string) =>
  transitionFulfillmentLease(sessionId, leaseId, "processing")
