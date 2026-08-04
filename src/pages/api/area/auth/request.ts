import type { APIRoute } from "astro"
import nodemailer from "nodemailer"
import { VIRYA_OPERATIONS_EMAIL, siteOriginForRequest } from "../../../../config"
import {
  consumeAreaAuthRateLimit,
  getAreaClientNetwork,
  isAreaAuthConfigured,
  issueAreaMagicToken,
  normalizeAreaEmail,
} from "../../../../server/areaAuth"
import {
  areaJson,
  getAreaWalletId,
  isSameOriginRequest,
  readSmallJson,
} from "../../../../server/areaHttp"

export const prerender = false

const GENERIC_RESPONSE = {
  ok: true,
  message: "If the address is valid, a sign-in link will arrive shortly.",
}

const requestLanguage = (body: unknown): "en" | "pl" => {
  if (!body || typeof body !== "object") return "en"
  const value = body as { lang?: unknown; returnTo?: unknown }
  if (value.lang === "pl" || value.returnTo === "/pl/area/") return "pl"
  return "en"
}

const publicSiteUrl = (request: Request) => {
  try {
    const url = new URL(siteOriginForRequest(request))
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    if (import.meta.env.PROD && url.protocol !== "https:") return null
    url.username = ""
    url.password = ""
    url.search = ""
    url.hash = ""
    return url
  } catch {
    return null
  }
}

const sendMagicLink = async (
  request: Request,
  email: string,
  lang: "en" | "pl",
  token: string,
) => {
  const user = VIRYA_OPERATIONS_EMAIL
  const pass = import.meta.env.GMAIL_APP_PASSWORD
  const base = publicSiteUrl(request)
  if (!user || !pass || !base) {
    throw new Error("Magic-link delivery is not configured")
  }

  base.pathname = lang === "pl" ? "/pl/area/" : "/area/"
  base.hash = new URLSearchParams({ auth: token }).toString()
  const link = base.toString()
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  })
  const subject =
    lang === "pl" ? "Twój link do VIRYA Area" : "Your VIRYA Area sign-in link"
  const intro =
    lang === "pl"
      ? "Kliknij poniższy link, aby zalogować się do VIRYA Area. Link wygaśnie za 15 minut i zadziała tylko raz."
      : "Use the link below to sign in to VIRYA Area. It expires in 15 minutes and can only be used once."
  const ignore =
    lang === "pl"
      ? "Jeżeli to nie Ty, zignoruj tę wiadomość."
      : "If you did not request this, ignore this message."

  await transporter.sendMail({
    from: `"VIRYA Area" <${user}>`,
    to: email,
    subject,
    text: `${intro}\n\n${link}\n\n${ignore}`,
    html: `<p>${intro}</p><p><a href="${link}">VIRYA Area — sign in</a></p><p>${ignore}</p>`,
  })
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }

  let body: unknown = null
  try {
    body = await readSmallJson(request)
  } catch {
    // Keep the public response indistinguishable from an unknown email.
  }

  const email = normalizeAreaEmail(
    body && typeof body === "object"
      ? (body as { email?: unknown }).email
      : null,
  )
  const lang = requestLanguage(body)
  const browserWalletId = getAreaWalletId(cookies)

  try {
    if (!isAreaAuthConfigured()) {
      return areaJson(GENERIC_RESPONSE, 202)
    }

    const networkAllowed = await consumeAreaAuthRateLimit(
      "network",
      getAreaClientNetwork(request),
      10,
      60 * 60 * 1000,
    )
    if (!email || !networkAllowed) {
      return areaJson(GENERIC_RESPONSE, 202)
    }
    const emailAllowed = await consumeAreaAuthRateLimit(
      "email",
      email,
      3,
      60 * 60 * 1000,
    )
    if (!emailAllowed) return areaJson(GENERIC_RESPONSE, 202)

    const issued = issueAreaMagicToken(email, browserWalletId, lang)
    if (issued) {
      await sendMagicLink(request, email, lang, issued.token)
    }
  } catch {
    // Never include the recipient or token in application logs.
    console.error("[area-auth-request] delivery unavailable")
  }

  return areaJson(GENERIC_RESPONSE, 202)
}

