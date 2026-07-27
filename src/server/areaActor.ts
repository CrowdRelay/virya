import {
  areaAccountWalletId,
  getAreaAccount,
  getAreaSession,
} from "./areaAuth"
import {
  getAreaWalletId,
  type AreaCookieJar,
} from "./areaHttp"

export type AreaActor =
  | {
      authenticated: true
      actorId: string
      accountId: string
      emailMasked?: string
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
    browserWalletId,
  }
}

