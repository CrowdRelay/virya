// Best-effort InPost ShipX shipment creation after a paid order.
// Only runs when INPOST_ORGANIZATION_ID + INPOST_SHIPX_TOKEN are set; otherwise
// the band creates the label manually in InPost ManageR from the emailed details.
// Docs: https://docs.inpost.pl/ (ShipX API)

const BASE_URLS = {
  production: "https://api.shipx-pl.easypack24.net",
  sandbox: "https://sandbox-api-shipx-pl.easypack24.net",
}

export const createInpostShipment = async ({ session }) => {
  const token = process.env.INPOST_SHIPX_TOKEN
  const orgId = process.env.INPOST_ORGANIZATION_ID
  if (!token || !orgId) {
    return {
      skipped: true,
      reason: "INPOST_ORGANIZATION_ID / INPOST_SHIPX_TOKEN not set",
    }
  }

  const meta = session.metadata || {}
  // Digital/test orders have no Paczkomat — nothing to ship.
  if (!meta.paczkomat_code) {
    return { skipped: true, reason: "no paczkomat (non-shipping order)" }
  }

  const base =
    BASE_URLS[process.env.INPOST_ENV === "sandbox" ? "sandbox" : "production"]
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
  })

  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    return { created: false, status: resp.status, error: data }
  }
  return { created: true, id: data.id, tracking: data.tracking_number || null }
}
