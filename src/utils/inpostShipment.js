import { readServerEnv } from "../server/runtimeEnv.ts"
const BASE_URLS = {
  production: "https://api.shipx-pl.easypack24.net",
  sandbox: "https://sandbox-api-shipx-pl.easypack24.net",
}
const REQUEST_TIMEOUT_MS = 10_000
const MAX_LOOKUP_PAGES = 10

const requestHeaders = token => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
})

const shipmentMatchesSession = (shipment, session, meta) =>
  shipment?.reference === session.id &&
  shipment?.service === "inpost_locker_standard" &&
  shipment?.custom_attributes?.target_point === meta.paczkomat_code

const findExistingShipment = async ({ base, orgId, token, session, meta }) => {
  const createdAt = Number(session.created)
  const searchStart = new Date(
    (Number.isFinite(createdAt)
      ? createdAt * 1000
      : Date.now() - 24 * 60 * 60 * 1000) -
      5 * 60 * 1000,
  ).toISOString()
  const receiverEmail = meta.inv_email || session.customer_details?.email || ""

  for (let page = 1; page <= MAX_LOOKUP_PAGES; page += 1) {
    const query = new URLSearchParams({
      created_at_gteq: searchStart,
      page: String(page),
      per_page: "100",
      sort_by: "created_at",
      sort_order: "desc",
    })
    if (receiverEmail) query.set("receiver_email", receiverEmail)

    const response = await fetch(
      `${base}/v1/organizations/${orgId}/shipments?${query}`,
      {
        headers: requestHeaders(token),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    )
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(
        `InPost shipment lookup failed with status ${response.status}`,
      )
    }

    const items = Array.isArray(data.items) ? data.items : []
    const sameReference = items.filter(
      shipment => shipment?.reference === session.id,
    )
    const match = sameReference.find(shipment =>
      shipmentMatchesSession(shipment, session, meta),
    )
    if (match) {
      if (match.status === "canceled") {
        throw new Error("The existing InPost shipment is canceled.")
      }
      return match
    }
    if (sameReference.length > 0) {
      throw new Error(
        "An InPost shipment with this checkout reference does not match the order.",
      )
    }

    const count = Number(data.count)
    const perPage = Math.max(1, Number(data.per_page) || 100)
    if (!Number.isFinite(count) || page * perPage >= count) return null
  }

  throw new Error("InPost shipment lookup exceeded its safe page limit.")
}

export const createInpostShipment = async ({ session }) => {
  const meta = session.metadata || {}
  if (!meta.paczkomat_code) {
    return { skipped: true, reason: "no paczkomat (non-shipping order)" }
  }

  const token = readServerEnv("INPOST_SHIPX_TOKEN", import.meta.env.INPOST_SHIPX_TOKEN)
  const orgId = readServerEnv("INPOST_ORGANIZATION_ID", import.meta.env.INPOST_ORGANIZATION_ID)
  if (!token || !orgId) {
    throw new Error(
      "INPOST_ORGANIZATION_ID / INPOST_SHIPX_TOKEN must be configured for shipping orders.",
    )
  }

  const base = BASE_URLS.production
  const customer = session.customer_details || {}
  const email = meta.inv_email || customer.email || ""
  const phone = (customer.phone || "").replace(/[^\d+]/g, "")
  if (!email || !phone) {
    return {
      created: false,
      status: 422,
      error: "A shipping order requires receiver email and phone.",
    }
  }

  const existing = await findExistingShipment({
    base,
    orgId,
    token,
    session,
    meta,
  })
  if (existing) {
    return {
      created: true,
      recovered: true,
      id: existing.id,
      tracking: existing.tracking_number || null,
    }
  }

  const body = {
    receiver: {
      email,
      phone,
      first_name: meta.inv_name || (customer.name || "Klient").split(" ")[0],
      last_name:
        meta.inv_surname ||
        (customer.name || "Virya").split(" ").slice(1).join(" ") ||
        "—",
    },
    parcels: [{ template: "small" }],
    custom_attributes: { target_point: meta.paczkomat_code },
    service: "inpost_locker_standard",
    reference: session.id,
  }

  try {
    const resp = await fetch(`${base}/v1/organizations/${orgId}/shipments`, {
      method: "POST",
      headers: requestHeaders(token),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    const data = await resp.json().catch(() => ({}))
    if (resp.ok) {
      return {
        created: true,
        id: data.id,
        tracking: data.tracking_number || null,
      }
    }

    const reconciled = await findExistingShipment({
      base,
      orgId,
      token,
      session,
      meta,
    })
    if (reconciled) {
      return {
        created: true,
        recovered: true,
        id: reconciled.id,
        tracking: reconciled.tracking_number || null,
      }
    }
    return { created: false, status: resp.status, error: data }
  } catch (error) {
    const reconciled = await findExistingShipment({
      base,
      orgId,
      token,
      session,
      meta,
    })
    if (reconciled) {
      return {
        created: true,
        recovered: true,
        id: reconciled.id,
        tracking: reconciled.tracking_number || null,
      }
    }
    throw error
  }
}
