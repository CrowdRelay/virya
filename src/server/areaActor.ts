import {
  areaAccountWalletId,
  getAreaAccount,
  getAreaSession,
} from "./areaAuth"
import {
  getAreaWalletId,
  isSameOriginRequest,
  type AreaCookieJar,
} from "./areaHttp"

export type AreaActor =
  | {
      authenticated: true
      actorId: string
      accountId: string
      emailMasked?: string
      backendPlayerId?: string
      browserWalletId: string
    }
  | {
      authenticated: false
      actorId: string
      browserWalletId: string
    }

export const getAreaActor = async (
  cookies: AreaCookieJar,
): Promise<AreaActor> => {
  const browserWalletId = getAreaWalletId(cookies)
  const session = getAreaSession(cookies)
  if (!session) {
    return {
      authenticated: false,
      actorId: browserWalletId,
      browserWalletId,
    }
  }

  const account = await getAreaAccount(session.accountId)
  if (!account) {
    return {
      authenticated: false,
      actorId: browserWalletId,
      browserWalletId,
    }
  }

  return {
    authenticated: true,
    actorId: areaAccountWalletId(session.accountId),
    accountId: session.accountId,
    emailMasked: account.emailMasked,
    backendPlayerId: account.backendPlayerId,
    browserWalletId,
  }
}

/** Website reads use only the signed first-party AREA session. Native clients
 * are handled explicitly by the compatibility proxy before this function. */
export const getAreaReadActor = async (
  request: Request,
  cookies: AreaCookieJar,
): Promise<AreaActor | null> => {
  if (request.headers.has("authorization")) return null
  return getAreaActor(cookies)
}

/** Website mutations stay same-origin. Native clients are handled by the
 * explicit compatibility proxy and cannot fall through to browser identity. */
export const getAreaMutationActor = async (
  request: Request,
  cookies: AreaCookieJar,
): Promise<AreaActor | null> => {
  if (!isSameOriginRequest(request) || request.headers.has("authorization")) {
    return null
  }
  return getAreaActor(cookies)
}
