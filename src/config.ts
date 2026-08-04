export const VIRYA_SITE_ORIGIN = "https://virya.music"
export const VIRYA_OPERATIONS_EMAIL = "virya.crew@gmail.com"

export const siteOriginForRequest = (request: Request) =>
  import.meta.env?.PROD ? VIRYA_SITE_ORIGIN : new URL(request.url).origin
