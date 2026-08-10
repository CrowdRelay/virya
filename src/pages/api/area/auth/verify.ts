import type { APIRoute } from "astro"
import {
  acquireAreaMagicUse,
  areaAccountWalletId,
  completeAreaMagicUse,
  releaseAreaMagicUse,
  setAreaSession,
  upsertAreaAccount,
  verifyAreaMagicToken,
} from "../../../../server/areaAuth"
import {
  areaJson,
  isSameOriginRequest,
  readSmallJsonObject,
} from "../../../../server/areaHttp"
import { ensureLegacyAreaImported } from "../../../../server/areaMigration"

export const prerender = false

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await readSmallJsonObject(request)
  } catch {
    return areaJson(
      {
        error: "The sign-in link is invalid or expired.",
        code: "INVALID_LINK",
      },
      400,
    )
  }

  const token = typeof body.token === "string" ? body.token : ""
  const payload = verifyAreaMagicToken(token)
  if (!payload) {
    return areaJson(
      {
        error: "The sign-in link is invalid or expired.",
        code: "INVALID_LINK",
      },
      400,
    )
  }

  let lease: Awaited<ReturnType<typeof acquireAreaMagicUse>>
  try {
    lease = await acquireAreaMagicUse(payload)
  } catch {
    return areaJson(
      { error: "Sign-in is temporarily unavailable.", code: "TEMPORARY" },
      503,
    )
  }
  if (lease.status !== "acquired") {
    return lease.status === "used"
      ? areaJson(
          { error: "This sign-in link was already used.", code: "LINK_USED" },
          409,
        )
      : areaJson(
          { error: "Sign-in is already processing.", code: "LINK_BUSY" },
          409,
        )
  }
  const leaseId = lease.leaseId

  try {
    const account = await upsertAreaAccount(payload.accountId, payload.email)
    if (account.backendPlayerId) {
      await ensureLegacyAreaImported(
        account.backendPlayerId,
        areaAccountWalletId(payload.accountId),
        payload.walletId,
      )
    }
    await completeAreaMagicUse(payload.nonce, leaseId)
    setAreaSession(cookies, payload.accountId)
    return areaJson({
      ok: true,
      authenticated: true,
      profile: { emailMasked: account.emailMasked },
    })
  } catch {
    try {
      await releaseAreaMagicUse(payload.nonce, leaseId)
    } catch {
      // The expired lease is recoverable on the next verification attempt.
    }
    console.error("[area-auth-verify] verification unavailable")
    return areaJson(
      { error: "Sign-in is temporarily unavailable.", code: "TEMPORARY" },
      503,
    )
  }
}
