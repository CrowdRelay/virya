import { createContext } from "preact"
import { useContext, useMemo } from "preact/hooks"

const IslandI18nContext = createContext(null)

// Mirrors localePath in I18nContext.jsx (kept separate so island bundles do
// not pull in the full translation dictionary). Null-handling must stay
// aligned with that implementation: null/undefined fall back to "/" and a
// missing leading slash is normalized before /pl prefixing.
const localePath = (path, lang) => {
  let clean = String(path == null ? "/" : path)
  if (!clean.startsWith("/")) clean = `/${clean}`
  clean = clean.replace(/^(?:\/pl)+(?=\/|$)/, "")
  if (clean === "") clean = "/"
  if (lang !== "pl") return clean
  return clean === "/" ? "/pl/" : `/pl${clean}`
}

export const IslandI18nProvider = ({ children, lang, messages }) => {
  const value = useMemo(
    () => ({
      lang,
      t: (key) => messages[key] ?? key,
      lp: (path) => localePath(path, lang),
    }),
    [lang, messages]
  )

  return (
    <IslandI18nContext.Provider value={value}>
      {children}
    </IslandI18nContext.Provider>
  )
}

export const useIslandI18n = () => useContext(IslandI18nContext)
