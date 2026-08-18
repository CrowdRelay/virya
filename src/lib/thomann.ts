export const THOMANN_AFFILIATE_ID = "4979"
export const THOMANN_OFFER_ID = "1"
export const THOMANN_SOURCE = "virya_music"
export const THOMANN_HOME_URL = "https://www.thomann.pl/"

export type ThomannPlacement =
  | "gear"
  | "partners"
  | "shop"
  | "footer"
  | "epk"

const ALLOWED_THOMANN_HOSTS = new Set([
  "thomann.pl",
  "www.thomann.pl",
  "thomann.de",
  "www.thomann.de",
])

export function thomannAffiliateUrl(
  target: string,
  placement: ThomannPlacement,
): string {
  const url = new URL(target)
  const hostname = url.hostname.toLowerCase()

  if (url.protocol !== "https:" || !ALLOWED_THOMANN_HOSTS.has(hostname)) {
    throw new Error(`Unsupported Thomann affiliate target: ${target}`)
  }

  url.searchParams.set("offid", THOMANN_OFFER_ID)
  url.searchParams.set("affid", THOMANN_AFFILIATE_ID)
  url.searchParams.set("subid", THOMANN_SOURCE)
  url.searchParams.set("subid2", placement)
  return url.toString()
}
