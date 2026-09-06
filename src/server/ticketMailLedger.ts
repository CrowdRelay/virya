import { randomUUID } from "node:crypto"
import { getStore } from "@netlify/blobs"

const STORE_NAME = "virya-ticket-mail-deliveries"
const LEASE_MS = 5 * 60 * 1_000
const MAX_CAS_ATTEMPTS = 6

type DeliveryRecord = {
  version: 1
  status: "processing" | "done" | "ambiguous"
  leaseId: string
  expiresAt: number
  updatedAt: string
  eventType: string
  orderId: string
}

export type TicketMailLease =
  | { status: "acquired"; leaseId: string }
  | { status: "busy" | "done" | "ambiguous" }

const store = () => getStore({ name: STORE_NAME, consistency: "strong" })
const recordKey = (eventId: string) => `events/${eventId}`

const normalize = (value: unknown): DeliveryRecord | null => {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<DeliveryRecord>
  if (
    record.version !== 1 ||
    (record.status !== "processing" && record.status !== "done" && record.status !== "ambiguous") ||
    typeof record.leaseId !== "string" ||
    typeof record.eventType !== "string" ||
    typeof record.orderId !== "string" ||
    !Number.isFinite(Number(record.expiresAt))
  ) {
    return null
  }
  return {
    version: 1,
    status: record.status,
    leaseId: record.leaseId,
    expiresAt: Number(record.expiresAt),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date(0).toISOString(),
    eventType: record.eventType,
    orderId: record.orderId,
  }
}

export const acquireTicketMailLease = async (
  eventId: string,
  eventType: string,
  orderId: string,
): Promise<TicketMailLease> => {
  const key = recordKey(eventId)
  const leaseId = randomUUID()

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await store().getWithMetadata(key, {
      type: "json",
      consistency: "strong",
    })
    const record = normalize(current?.data)
    if (record?.status === "done") return { status: "done" }
    if (record?.status === "ambiguous") return { status: "ambiguous" }
    if (record?.status === "processing" && record.expiresAt > Date.now()) {
      return { status: "busy" }
    }

    const next: DeliveryRecord = {
      version: 1,
      status: "processing",
      leaseId,
      expiresAt: Date.now() + LEASE_MS,
      updatedAt: new Date().toISOString(),
      eventType,
      orderId,
    }
    const write = await store().setJSON(
      key,
      next,
      current ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
    )
    if (write.modified) return { status: "acquired", leaseId }
  }

  throw new Error("Ticket mail lease is busy; retry")
}

const transition = async (
  eventId: string,
  leaseId: string,
  status: "processing" | "done" | "ambiguous",
) => {
  const key = recordKey(eventId)
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await store().getWithMetadata(key, {
      type: "json",
      consistency: "strong",
    })
    const record = normalize(current?.data)
    if (record?.status === "done" || record?.status === "ambiguous") return
    if (!current || !record || record.leaseId !== leaseId) {
      throw new Error("Ticket mail lease ownership was lost")
    }
    const next: DeliveryRecord = {
      ...record,
      status,
      expiresAt: status === "done" ? 0 : Date.now() - 1,
      updatedAt: new Date().toISOString(),
    }
    const write = await store().setJSON(key, next, { onlyIfMatch: current.etag })
    if (write.modified) return
  }
  throw new Error("Ticket mail lease transition is busy; retry")
}

export const completeTicketMailLease = (eventId: string, leaseId: string) =>
  transition(eventId, leaseId, "done")

/**
 * Provider execution started but its final acceptance could not be proven.
 * This is terminal by design: automatic retries could duplicate an email when
 * SMTP/HTTP accepted the message but the response was lost.
 */
export const markTicketMailAmbiguous = (eventId: string, leaseId: string) =>
  transition(eventId, leaseId, "ambiguous")
