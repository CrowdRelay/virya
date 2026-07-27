import { createContext } from "preact"
import { useContext, useEffect, useCallback, useMemo } from "preact/hooks"
import { translations, LANGS, DEFAULT_LANG } from "./translations"

const STORAGE_KEY = "virya-lang"
const I18nContext = createContext(null)

export const localePath = (path, lang) => {
  let clean = String(path == null ? "/" : path)
  if (!clean.startsWith("/")) clean = `/${clean}`
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
  const lang = LANGS.includes(initialLang) ? initialLang : DEFAULT_LANG

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  const t = useCallback((key, params) => resolve(lang, key, params), [lang])
  const lp = useCallback((path) => localePath(path, lang), [lang])

  const value = useMemo(() => ({ lang, t, lp }), [lang, t, lp])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = () => {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    return {
      lang: DEFAULT_LANG,
      t: (key, params) => resolve(DEFAULT_LANG, key, params),
      lp: (path) => localePath(path, DEFAULT_LANG),
    }
  }
  return ctx
}
