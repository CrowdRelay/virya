const BASE_URLS = {
  production: "https://api.shipx-pl.easypack24.net",
  sandbox: "https://sandbox-api-shipx-pl.easypack24.net",
}
const REQUEST_TIMEOUT_MS = 10_000

export const createInpostShipment = async ({ session }) => {
  const token = import.meta.env.INPOST_SHIPX_TOKEN
  const orgId = import.meta.env.INPOST_ORGANIZATION_ID
  if (!token || !orgId) {
    return {
      skipped: true,
      reason: "INPOST_ORGANIZATION_ID / INPOST_SHIPX_TOKEN not set",
    }
  }

  const meta = session.metadata || {}
  if (!meta.paczkomat_code) {
    return { skipped: true, reason: "no paczkomat (non-shipping order)" }
  }

  const base =
    BASE_URLS[import.meta.env.INPOST_ENV === "sandbox" ? "sandbox" : "production"]
  const customer = session.customer_details || {}

  const body = {
    receiver: {
      email: customer.email,
      phone: (customer.phone || "").replace(/\s+/g, ""),
      first_name: (customer.name || "Klient").split(" ")[0],
      last_name:
        (customer.name || "Virya").split(" ").slice(1).join(" ") || "—",
    },
    parcels: [{ template: "small" }],
    custom_attributes: { target_point: meta.paczkomat_code },
    service: "inpost_locker_standard",
    reference: session.id,
  }

  const resp = await fetch(`${base}/v1/organizations/${orgId}/shipments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    return { created: false, status: resp.status, error: data }
  }
  return { created: true, id: data.id, tracking: data.tracking_number || null }
}
