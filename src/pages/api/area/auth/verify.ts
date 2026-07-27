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
  readSmallJson,
} from "../../../../server/areaHttp"
import {
  AreaWalletMigrationConflictError,
  migrateAreaWallet,
} from "../../../../server/areaLedger"

export const prerender = false

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }

  let body: unknown
  try {
    body = await readSmallJson(request)
  } catch {
    return areaJson(
      {
        error: "The sign-in link is invalid or expired.",
        code: "INVALID_LINK",
      },
      400,
    )
  }

  const token =
    body && typeof body === "object" && typeof (body as any).token === "string"
      ? (body as any).token
      : ""
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
    try {
      await migrateAreaWallet(
        payload.walletId,
        areaAccountWalletId(payload.accountId),
      )
    } catch (error) {
      // A browser wallet is intentionally transferable only once. Reusing the
      // same browser for another account must not block that account's login;
      // it simply signs in without copying the already-bound legacy wallet.
      if (!(error instanceof AreaWalletMigrationConflictError)) throw error
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
