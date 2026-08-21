import { readServerEnv } from "./runtimeEnv.ts"

// YouTube's per-channel Atom feed is public, keyless and unmetered, and it
// carries view and like counts per video. That covers everything except the
// subscriber count, which needs a Data API key — optional, see loadSubscribers.

const DEFAULT_CHANNEL_ID = "UCbftHqqkc2xzRyHkQaoo2rw"
const FEED_URL = "https://www.youtube.com/feeds/videos.xml"
const API_URL = "https://www.googleapis.com/youtube/v3/channels"
const REQUEST_TIMEOUT_MS = 6_000
const MAX_FEED_BYTES = 512 * 1024
const MAX_ENTRIES = 15

export type YoutubeVideo = {
  id: string
  title: string
  publishedAt: string
  views: number | null
  likes: number | null
}

export type YoutubeChannel = {
  recentViews: number | null
  latest: YoutubeVideo | null
  videos: YoutubeVideo[]
  subscribers: number | null
}

const channelId = () => {
  const configured = readServerEnv(
    "YOUTUBE_CHANNEL_ID",
    import.meta.env.YOUTUBE_CHANNEL_ID,
  )
  return typeof configured === "string" && /^UC[A-Za-z0-9_-]{22}$/.test(configured.trim())
    ? configured.trim()
    : DEFAULT_CHANNEL_ID
}

const readLimitedText = async (response: Response): Promise<string> => {
  const reader = response.body?.getReader()
  if (!reader) return ""
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_FEED_BYTES) throw new Error("Feed exceeded the byte budget")
      chunks.push(decoder.decode(value, { stream: true }))
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return chunks.join("")
}

const unescapeXml = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")

const digits = (value: string | undefined): number | null => {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

const parseEntries = (xml: string): YoutubeVideo[] => {
  const videos: YoutubeVideo[] = []
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    if (videos.length >= MAX_ENTRIES) break
    const entry = match[1]
    const id = entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1]
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]
    const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1]
    if (!id || !title || !publishedAt) continue
    videos.push({
      id,
      title: unescapeXml(title).trim(),
      publishedAt,
      views: digits(entry.match(/statistics[^>]*views="(\d+)"/)?.[1]),
      likes: digits(entry.match(/starRating[^>]*count="(\d+)"/)?.[1]),
    })
  }
  return videos
}

const loadFeed = async (): Promise<YoutubeVideo[]> => {
  const url = new URL(FEED_URL)
  url.searchParams.set("channel_id", channelId())
  const response = await fetch(url, {
    headers: { Accept: "application/atom+xml" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`YouTube feed returned ${response.status}`)
  return parseEntries(await readLimitedText(response))
}

/**
 * Subscriber count is the one figure the public feed withholds. Returns null
 * unless YOUTUBE_API_KEY is configured; the request costs 1 quota unit.
 */
const loadSubscribers = async (): Promise<number | null> => {
  const key = readServerEnv("YOUTUBE_API_KEY", import.meta.env.YOUTUBE_API_KEY)
  if (typeof key !== "string" || !key.trim()) return null

  const url = new URL(API_URL)
  url.searchParams.set("part", "statistics")
  url.searchParams.set("id", channelId())
  url.searchParams.set("key", key.trim())
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`YouTube API returned ${response.status}`)
  const payload = (await response.json()) as {
    items?: { statistics?: { subscriberCount?: string } }[]
  }
  return digits(payload.items?.[0]?.statistics?.subscriberCount)
}

/** Never throws. A dead source yields nulls so the caller still renders. */
export const getYoutubeChannel = async (): Promise<YoutubeChannel> => {
  const [feed, subscribers] = await Promise.allSettled([loadFeed(), loadSubscribers()])

  const videos = feed.status === "fulfilled" ? feed.value : []
  if (feed.status === "rejected") {
    console.warn("[youtube] feed unavailable", feed.reason)
  }
  if (subscribers.status === "rejected") {
    console.warn("[youtube] subscriber lookup failed", subscribers.reason)
  }

  const counted = videos.filter(video => video.views !== null)
  return {
    recentViews: counted.length
      ? counted.reduce((total, video) => total + (video.views ?? 0), 0)
      : null,
    latest: videos[0] ?? null,
    videos,
    subscribers: subscribers.status === "fulfilled" ? subscribers.value : null,
  }
}
