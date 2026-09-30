import { readServerEnv } from "./runtimeEnv.ts"
import { readLimitedJson } from "./readLimitedJson.ts"

const DEFAULT_CROWDRELAY_URL = "https://signal-api.virya.music/v1/"
// The watch page sits on the click path of every smart link: the fan is
// already waiting behind a redirect, so the metadata fetch gets a tight
// budget and every failure hands them straight to YouTube instead.
const REQUEST_TIMEOUT_MS = 1_500
const MAX_RESPONSE_BYTES = 16 * 1024

export type PublicVideo = {
  youtube_id: string
  title: string
  published_at: string
}

const baseUrl = () => {
  const configured = readServerEnv(
    "PUBLIC_CROWDRELAY_API_URL",
    import.meta.env.PUBLIC_CROWDRELAY_API_URL,
  )
  const value =
    typeof configured === "string" && configured.trim()
      ? configured.trim()
      : DEFAULT_CROWDRELAY_URL
  const url = new URL(value)
  const localHttp = import.meta.env.DEV && url.protocol === "http:"
  if (
    (url.protocol !== "https:" && !localHttp) ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid CrowdRelay URL")
  }
  url.search = ""
  url.hash = ""
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
  return url
}

const asPublicVideo = (payload: unknown): PublicVideo | null => {
  if (typeof payload !== "object" || payload === null) return null
  const record = payload as Record<string, unknown>
  if (
    typeof record.youtube_id !== "string" ||
    typeof record.title !== "string" ||
    typeof record.published_at !== "string" ||
    !record.title
  ) {
    return null
  }
  return {
    youtube_id: record.youtube_id,
    title: record.title,
    published_at: record.published_at,
  }
}

// Null on any failure — invalid id, unknown video, timeout or outage all land
// the fan on the plain YouTube watch URL rather than a dead end.
export const loadPublicVideo = async (
  id: string,
): Promise<PublicVideo | null> => {
  try {
    const response = await fetch(
      new URL(`public/videos/${encodeURIComponent(id)}`, baseUrl()),
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      },
    )
    if (!response.ok) return null
    return asPublicVideo(await readLimitedJson<unknown>(response, MAX_RESPONSE_BYTES))
  } catch {
    return null
  }
}
