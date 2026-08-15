import { readServerEnv } from "./runtimeEnv.ts"
import {
  consumePublicFormRateLimit,
  publicRequestNetwork,
} from "./publicFormRate.ts"

export const signalFeedbackNetwork = publicRequestNetwork

export const consumeSignalFeedbackRateLimit = async (
  network: string,
  limit = 8,
  windowMs = 60 * 60 * 1_000,
) => {
  const dedicated = readServerEnv(
    "SIGNAL_FEEDBACK_RATE_SECRET",
    import.meta.env.SIGNAL_FEEDBACK_RATE_SECRET,
  )
  const existing = readServerEnv("AREA_AUTH_SECRET", import.meta.env.AREA_AUTH_SECRET)
  const secret = typeof dedicated === "string" && dedicated.length >= 32
    ? dedicated
    : typeof existing === "string" && existing.length >= 32
      ? existing
      : null
  if (!secret) throw new Error("signal_feedback_rate_limit_unconfigured")
  return consumePublicFormRateLimit(
    "signal-feedback",
    network,
    secret,
    limit,
    windowMs,
  )
}
