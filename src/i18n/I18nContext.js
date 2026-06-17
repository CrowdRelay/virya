"use client"
import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
} from "react"
import { translations, LANGS, DEFAULT_LANG } from "./translations"

const STORAGE_KEY = "virya-lang"
const I18nContext = createContext(null)

// Idempotent language-aware path builder. Strips any existing /pl prefix first,
// so it never double-prefixes (no /pl/pl), then re-applies for the target lang.
// Always feed it the canonical English path (e.g. "/merch").
export const localePath = (path, lang) => {
  let clean = String(path == null ? "/" : path)
  if (!clean.startsWith("/")) clean = `/${clean}`
  // Strip one *or more* leading /pl segments so even a malformed /pl/pl URL
  // self-heals — guarantees we can never build a double prefix.
  clean = clean.replace(/^(?:\/pl)+(?=\/|$)/, "")
  if (clean === "") clean = "/"
  if (lang !== "pl") return clean
  return clean === "/" ? "/pl/" : `/pl${clean}`
}

const resolve = (lang, key, params) => {
  const dict = translations[lang] || translations[DEFAULT_LANG]
  let val = key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), dict)
  if (val == null) {
    val = key
      .split(".")
      .reduce(
        (o, k) => (o == null ? undefined : o[k]),
        translations[DEFAULT_LANG]
      )
  }
  if (typeof val === "function") return val(params)
  return val == null ? key : val
}

export const LanguageProvider = ({ children, initialLang }) => {
  // The language is fixed by the URL (page context) — each page is rendered in
  // its own language on the server, so there is no client-side swap or shift.
  const lang = LANGS.includes(initialLang) ? initialLang : DEFAULT_LANG

  // Keep <html lang> correct and remember the current language as the visitor's
  // preference, so first-visit auto-detection (gatsby-browser) can honour it.
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  const t = useCallback((key, params) => resolve(lang, key, params), [lang])
  const lp = useCallback(path => localePath(path, lang), [lang])

  const value = useMemo(() => ({ lang, t, lp }), [lang, t, lp])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// Safe even outside a provider (returns English helpers).
export const useI18n = () => {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    return {
      lang: DEFAULT_LANG,
      t: (key, params) => resolve(DEFAULT_LANG, key, params),
      lp: path => localePath(path, DEFAULT_LANG),
    }
  }
  return ctx
}
