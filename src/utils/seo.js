import { LANGS, DEFAULT_LANG } from "../i18n/translations"

const SITE_URL = "https://www.virya.music"

/**
 * Generates canonical URL and hreflang tags for a given path and language.
 * @param {string} path - The page path (e.g., "/band/", "/merch")
 * @param {string} currentLang - The current language (e.g., "en", "pl")
 * @returns {Object} Object containing canonicalUrl and hreflangLinks
 */
export const getSeoTags = (path, currentLang = DEFAULT_LANG) => {
  const normalizedPath = path === "/" ? "/" : path.replace(/\/$/, "")
  
  const canonicalUrl = currentLang === DEFAULT_LANG 
    ? `${SITE_URL}${normalizedPath}`
    : `${SITE_URL}/${currentLang}${normalizedPath}`
  
  const hreflangLinks = LANGS.map(lang => {
    const langPath = lang === DEFAULT_LANG 
      ? normalizedPath 
      : `/${lang}${normalizedPath}`
    return {
      rel: "alternate",
      hreflang: lang,
      href: `${SITE_URL}${langPath}`
    }
  })
  
  hreflangLinks.push({
    rel: "alternate",
    hreflang: "x-default",
    href: `${SITE_URL}${normalizedPath}`
  })
  
  return {
    canonicalUrl,
    hreflangLinks
  }
}
