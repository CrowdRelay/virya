import type { APIRoute } from "astro"
import { areaJson } from "../../../../server/areaHttp"
import {
  hasStaffQrSession,
  isStaffQrConfigured,
} from "../../../../server/staffQrAuth"
import { isStaffApiConfigured } from "../../../../server/staffQrApi"
import { VIRYA_OPERATIONS_EMAIL } from "../../../../config"

export const prerender = false

const configured = (value: unknown, min = 1) =>
  typeof value === "string" && value.trim().length >= min

export const GET: APIRoute = async ({ cookies }) => {
  const authenticated = hasStaffQrSession(cookies)
  return areaJson({
    authenticated,
    configured: isStaffQrConfigured() && isStaffApiConfigured(),
    capabilities: authenticated
      ? {
          crowdrelayAdmin: configured(import.meta.env.CROWDRELAY_ADMIN_API_KEY, 24),
          crowdrelayCommerce: configured(import.meta.env.CROWDRELAY_COMMERCE_API_KEY, 24),
          crowdrelayWebhook: configured(import.meta.env.CROWDRELAY_WEBHOOK_SECRET, 24),
          crowdrelayMailer: configured(import.meta.env.CROWDRELAY_MAILER_API_KEY, 24),
          ticketMailer: configured(import.meta.env.VIRYA_TICKET_MAILER_API_KEY, 24),
          gmail:
            configured(VIRYA_OPERATIONS_EMAIL) &&
            configured(import.meta.env.GMAIL_APP_PASSWORD, 8),
          stripe: configured(import.meta.env.STRIPE_SECRET_KEY, 16),
        }
      : undefined,
  })
}
