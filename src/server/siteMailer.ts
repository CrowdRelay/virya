import nodemailer from "nodemailer"

let cachedMailer: ReturnType<typeof nodemailer.createTransport> | undefined

export const getSiteMailer = () => {
  const user = import.meta.env.GMAIL_USER
  const pass = import.meta.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return null

  cachedMailer ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })

  return {
    transporter: cachedMailer,
    user,
    to: import.meta.env.ORDER_EMAIL_TO || user,
  }
}
