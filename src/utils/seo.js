import { LANGS, DEFAULT_LANG } from "../i18n/translations"

const SITE_URL = "https://www.virya.music"

/**
 * Generates canonical URL and hreflang tags for a given path and language.
 * @param {string} path - The page path (e.g., "/band/", "/merch")
 * @param {string} currentLang - The current language (e.g., "en", "pl")
 * @returns {Object} Object containing canonicalUrl and hreflangLinks
 */
// Canonical and hreflang URLs use one trailing-slash policy. A mismatch here
// makes crawlers treat the alternate URL as a separate page.
const withTrailingSlash = p => (p === "" || p.endsWith("/") ? p : `${p}/`)

export const getSeoTags = (path, currentLang = DEFAULT_LANG) => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`
  const normalizedPath = withTrailingSlash(cleanPath)

  const buildUrl = lang => {
    const langPrefix = lang === DEFAULT_LANG ? "" : `/${lang}`
    return `${SITE_URL}${withTrailingSlash(`${langPrefix}${normalizedPath}`)}`
  }

  const canonicalUrl = buildUrl(currentLang)

  const hreflangLinks = LANGS.map(lang => ({
    rel: "alternate",
    hreflang: lang,
    href: buildUrl(lang)
  }))

  hreflangLinks.push({
    rel: "alternate",
    hreflang: "x-default",
    href: buildUrl(DEFAULT_LANG)
  })

  return {
    canonicalUrl,
    hreflangLinks
  }
}
