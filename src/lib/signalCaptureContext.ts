export interface SignalCaptureContext {
  offer?: "shows" | "releases"
  event_slug?: string
  video_id?: string
}
export function validatedCaptureContext(value: unknown): SignalCaptureContext | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const v = value as Record<string, unknown>
  const offer = v.offer === "shows" || v.offer === "releases" ? v.offer : undefined
  const event = typeof v.event_slug === "string" && /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/.test(v.event_slug) ? v.event_slug : undefined
  const video = typeof v.video_id === "string" && /^[A-Za-z0-9_-]{11}$/.test(v.video_id) ? v.video_id : undefined
  if (event && video) return offer ? { offer } : undefined
  const context = {...(offer ? {offer} : {}),...(event ? {event_slug:event} : {}),...(video ? {video_id:video} : {})}
  return Object.keys(context).length ? context : undefined
}
export function captureContextFromSearch(search: string): SignalCaptureContext | undefined {
  const q = new URLSearchParams(search)
  return validatedCaptureContext({offer:q.get("offer"),event_slug:q.get("event"),video_id:q.get("video")})
}
export function captureContextForPage(path: string, search: string): SignalCaptureContext | undefined {
  const event = path.match(/^\/(?:pl\/)?live\/([a-z0-9-]+)\/?$/)?.[1]
  if (event) return validatedCaptureContext({offer:"shows",event_slug:event})
  const video = path.match(/^\/(?:pl\/)?watch\/([A-Za-z0-9_-]+)\/?$/)?.[1]
  if (video) return validatedCaptureContext({offer:"releases",video_id:video})
  return captureContextFromSearch(search)
}
export function captureReturnPath(value: unknown, lang: "pl" | "en"): string {
  const c = validatedCaptureContext(value), prefix = lang === "pl" ? "/pl" : ""
  if (c?.event_slug) return `${prefix}/live/${c.event_slug}/`
  if (c?.video_id) return `${prefix}/watch/${c.video_id}/`
  if (c?.offer === "shows") return `${prefix}/signal/#signal-shows`
  if (c?.offer === "releases") return `${prefix}/videos/`
  return `${prefix}/my-signal/`
}
