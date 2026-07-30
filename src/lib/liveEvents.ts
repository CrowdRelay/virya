import type { PublicEvent } from "./crowdrelay-client"

export const loadLiveEvents = async (signal?: AbortSignal): Promise<PublicEvent[]> => {
  const response = await fetch("/api/events", {
    headers: { Accept: "application/json" },
    signal,
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Events endpoint returned ${response.status}`)
  const payload = (await response.json()) as { events?: unknown }
  return Array.isArray(payload.events) ? (payload.events as PublicEvent[]) : []
}
