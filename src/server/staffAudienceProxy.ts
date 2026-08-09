import { StaffQrUpstreamError } from "./staffQrApi"

export const staffAudienceStatus = (error: unknown) => {
  if (!(error instanceof StaffQrUpstreamError)) return 502
  if (error.status === 401 || error.status === 403) return 502
  return [400, 404, 409, 422, 429, 503].includes(error.status)
    ? error.status
    : 502
}

export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export const isSlug = (value: string) => /^[a-z0-9][a-z0-9_-]{0,127}$/.test(value)
export const isAudienceTag = (value: string) => /^[a-z0-9][a-z0-9:_-]{0,63}$/.test(value)
