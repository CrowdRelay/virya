import nodemailer from "nodemailer"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_ENDPOINT = "https://api.resend.com/emails"
const MAX_PROVIDER_ERROR = 2_048
const MAX_DISPLAY_NAME = 80

type SiteMailAttachment = {
  filename: string
  content: Uint8Array
  contentType?: string
  cid?: string
}

type SiteMailMessage = {
  to: string
  subject: string
  text: string
  html?: string
  fromName?: string
  replyTo?: string
  idempotencyKey?: string
  attachments?: readonly SiteMailAttachment[]
}

type SiteMailResult = {
  messageId: string
}

type SiteMailSender = (message: SiteMailMessage) => Promise<SiteMailResult>

type SiteMailer = {
  provider: "resend" | "gmail"
  to: string
  send: SiteMailSender
}

let cachedGmailSender: SiteMailSender | undefined

const envString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null

const email = (value: unknown) => {
  const parsed = envString(value)
  return parsed && EMAIL_PATTERN.test(parsed) ? parsed : null
}

const displayName = (value: unknown) => {
  const parsed = envString(value) ?? "Virya Signal"
  const safe = parsed.replace(/[\r\n<>\"]/g, " ").replace(/\s+/g, " ").trim()
  return safe.slice(0, MAX_DISPLAY_NAME) || "Virya Signal"
}

const friendlyFrom = (address: string, name?: string) =>
  `${displayName(name)} <${address}>`

const providerError = async (response: Response) => {
  const body = (await response.text()).slice(0, MAX_PROVIDER_ERROR)
  return new Error(`Resend rejected the message (${response.status}): ${body || response.statusText}`)
}

const requireRecipient = (value: unknown) => {
  const recipient = email(value)
  if (!recipient) throw new Error("invalid_mail_recipient")
  return recipient
}

const boundedIdempotencyKey = (value: unknown) => {
  const key = envString(value)
  return key ? key.slice(0, 256) : null
}

const resendMailer = (): SiteMailer | null => {
  const apiKey = envString(import.meta.env.RESEND_API_KEY)
  const from = email(import.meta.env.SIGNAL_MAIL_FROM)
  if (!apiKey || !from) return null

  const defaultReplyTo = email(import.meta.env.SIGNAL_MAIL_REPLY_TO) ?? from
  const operationsTo = email(import.meta.env.ORDER_EMAIL_TO) ?? defaultReplyTo

  return {
    provider: "resend",
    to: operationsTo,
    async send(message) {
      const recipient = requireRecipient(message.to)
      const replyTo = email(message.replyTo) ?? defaultReplyTo
      const idempotencyKey = boundedIdempotencyKey(message.idempotencyKey)
      const requestHeaders: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      }
      if (idempotencyKey) requestHeaders["Idempotency-Key"] = idempotencyKey

      const mailHeaders: Record<string, string> = {
        "Auto-Submitted": "auto-generated",
      }
      if (idempotencyKey) mailHeaders["X-Entity-Ref-ID"] = idempotencyKey

      const body: Record<string, unknown> = {
        from: friendlyFrom(from, message.fromName),
        to: [recipient],
        reply_to: replyTo,
        subject: message.subject,
        text: message.text,
        headers: mailHeaders,
      }
      if (message.html) body.html = message.html
      if (message.attachments?.length) {
        body.attachments = message.attachments.map((attachment) => ({
          filename: attachment.filename,
          content: Buffer.from(attachment.content).toString("base64"),
          ...(attachment.contentType ? { content_type: attachment.contentType } : {}),
          ...(attachment.cid ? { content_id: attachment.cid } : {}),
        }))
      }

      const response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(body),
      })
      if (!response.ok) throw await providerError(response)
      const result = await response.json().catch(() => null) as { id?: unknown } | null
      return {
        messageId: typeof result?.id === "string" ? result.id : "resend-accepted",
      }
    },
  }
}

const gmailMailer = (): SiteMailer | null => {
  const user = email(import.meta.env.GMAIL_USER)
  const pass = envString(import.meta.env.GMAIL_APP_PASSWORD)
  if (!user || !pass) return null

  const defaultReplyTo = email(import.meta.env.SIGNAL_MAIL_REPLY_TO) ?? email(import.meta.env.ORDER_EMAIL_TO) ?? user
  const operationsTo = email(import.meta.env.ORDER_EMAIL_TO) ?? user

  if (!cachedGmailSender) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      pool: true,
      maxConnections: 2,
      maxMessages: 100,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })

    cachedGmailSender = async (message) => {
      const recipient = requireRecipient(message.to)
      const replyTo = email(message.replyTo) ?? defaultReplyTo
      const idempotencyKey = boundedIdempotencyKey(message.idempotencyKey)
      const headers: Record<string, string> = {
        "Auto-Submitted": "auto-generated",
      }
      if (idempotencyKey) headers["X-Entity-Ref-ID"] = idempotencyKey

      const result = await transporter.sendMail({
        from: friendlyFrom(user, message.fromName),
        sender: user,
        envelope: { from: user, to: recipient },
        to: recipient,
        replyTo,
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        headers,
        ...(message.attachments?.length
          ? {
              attachments: message.attachments.map((attachment) => ({
                filename: attachment.filename,
                content: Buffer.from(attachment.content),
                ...(attachment.contentType ? { contentType: attachment.contentType } : {}),
                ...(attachment.cid ? { cid: attachment.cid } : {}),
              })),
            }
          : {}),
      })
      return { messageId: String(result.messageId ?? "") }
    }
  }

  return {
    provider: "gmail",
    to: operationsTo,
    send: cachedGmailSender,
  }
}

export const getSiteMailer = (): SiteMailer | null => {
  const preferred = envString(import.meta.env.MAIL_PROVIDER)?.toLowerCase()
  if (preferred === "resend") return resendMailer()
  if (preferred === "gmail") return gmailMailer()
  return resendMailer() ?? gmailMailer()
}
