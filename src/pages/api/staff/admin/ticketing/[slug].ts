import { randomUUID } from "node:crypto"
import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest } from "../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../server/staffQrAuth"
import {
  StaffQrUpstreamError,
  staffApiRequest,
} from "../../../../../server/staffQrApi"

export const prerender = false

const MAX_BODY_BYTES = 64 * 1024
const SLUG = /^[a-z0-9][a-z0-9_-]{0,127}$/
const CURRENCY = /^[A-Z]{3}$/
const TYPE_SLUG = /^[a-z0-9][a-z0-9_-]{0,127}$/
const CONTROL = /[\u0000-\u001f\u007f]/

const text = (value: unknown, max: number, required = true) => {
  if (typeof value !== "string") return required ? null : ""
  const result = value.trim()
  if ((required && !result) || result.length > max || CONTROL.test(result)) return null
  return result
}
const integer = (value: unknown, min: number, max: number) => {
  const number = Number(value)
  return Number.isInteger(number) && number >= min && number <= max ? number : null
}
const iso = (value: unknown) => {
  const result = text(value, 64)
  return result && !Number.isNaN(Date.parse(result)) ? new Date(result).toISOString() : null
}
const upstreamStatus = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 401, 404, 409, 422, 429, 503].includes(error.status)
    ? error.status
    : 502

export const GET: APIRoute = async ({ cookies, params }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const slug = params.slug ?? ""
  if (!SLUG.test(slug)) return areaJson({ error: "Invalid event" }, 400)
  try {
    return areaJson(
      await staffApiRequest(`admin/events/${encodeURIComponent(slug)}/ticketing`, {
        timeoutMs: 10_000,
      }),
    )
  } catch (error) {
    console.error("[staff-admin-ticketing-get]", error)
    return areaJson({ error: "Ticketing configuration unavailable" }, upstreamStatus(error))
  }
}

export const POST: APIRoute = async ({ request, cookies, params }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  const slug = params.slug ?? ""
  if (!SLUG.test(slug)) return areaJson({ error: "Invalid event" }, 400)

  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return areaJson({ error: "Request too large" }, 413)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    return areaJson({ error: "Invalid request" }, 400)
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return areaJson({ error: "Invalid request" }, 400)
  }
  const body = parsed as Record<string, unknown>
  const currency = text(body.currency, 3)?.toUpperCase() ?? null
  const vat = integer(body.vat_rate_basis_points, 0, 10_000)
  const capacity = integer(body.capacity, 1, 1_000_000)
  const maxPerOrder = integer(body.max_per_order, 1, 1_000)
  const holdSeconds = integer(body.hold_seconds, 60, 86_400)
  const salesOpenAt = iso(body.sales_open_at)
  const salesCloseAt = iso(body.sales_close_at)
  const active = body.active === true
  if (
    !currency || !CURRENCY.test(currency) || vat == null || capacity == null ||
    maxPerOrder == null || holdSeconds == null || !salesOpenAt || !salesCloseAt ||
    Date.parse(salesCloseAt) <= Date.parse(salesOpenAt) ||
    !Array.isArray(body.ticket_types) || body.ticket_types.length < 1 || body.ticket_types.length > 24
  ) {
    return areaJson({ error: "Invalid ticketing configuration" }, 400)
  }

  const ticketTypes: Array<Record<string, unknown>> = []
  const slugs = new Set<string>()
  let totalCapacity = 0
  for (const [index, rawType] of body.ticket_types.entries()) {
    if (!rawType || typeof rawType !== "object" || Array.isArray(rawType)) {
      return areaJson({ error: "Invalid ticket type" }, 400)
    }
    const type = rawType as Record<string, unknown>
    const typeSlug = text(type.slug, 128)
    const name = text(type.name, 160)
    const description = type.description == null || type.description === ""
      ? null
      : text(type.description, 1_000)
    const price = integer(type.price_gross_minor, 0, 100_000_000)
    const typeCapacity = type.capacity == null || type.capacity === ""
      ? null
      : integer(type.capacity, 1, 1_000_000)
    const sortOrder = integer(type.sort_order ?? index, -10_000, 10_000)
    if (
      !typeSlug || !TYPE_SLUG.test(typeSlug) || slugs.has(typeSlug) || !name ||
      description === null && type.description != null && type.description !== "" ||
      price == null || sortOrder == null
    ) {
      return areaJson({ error: "Invalid ticket type" }, 400)
    }
    slugs.add(typeSlug)
    if (typeCapacity != null) totalCapacity += typeCapacity
    ticketTypes.push({
      slug: typeSlug,
      name,
      description,
      price_gross_minor: price,
      capacity: typeCapacity,
      sort_order: sortOrder,
      active: type.active === true,
    })
  }
  if (totalCapacity > 0 && totalCapacity > capacity) {
    return areaJson({ error: "Ticket type capacity exceeds sale capacity" }, 400)
  }

  try {
    await staffApiRequest(`admin/events/${encodeURIComponent(slug)}/ticketing`, {
      method: "POST",
      body: {
        currency,
        vat_rate_basis_points: vat,
        capacity,
        max_per_order: maxPerOrder,
        hold_seconds: holdSeconds,
        sales_open_at: salesOpenAt,
        sales_close_at: salesCloseAt,
        active,
        ticket_types: ticketTypes,
      },
      idempotencyKey: `staff-ticketing-${randomUUID()}`,
      timeoutMs: 15_000,
    })
    return areaJson(
      await staffApiRequest(`admin/events/${encodeURIComponent(slug)}/ticketing`, {
        timeoutMs: 12_000,
      }),
    )
  } catch (error) {
    console.error("[staff-admin-ticketing-post]", error)
    return areaJson({ error: "Ticketing configuration could not be saved" }, upstreamStatus(error))
  }
}
