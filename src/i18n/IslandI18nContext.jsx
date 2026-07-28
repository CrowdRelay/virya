import { createContext } from "preact"
import { useContext, useMemo } from "preact/hooks"

const IslandI18nContext = createContext(null)

const localePath = (path, lang) => {
  const clean = String(path || "/").replace(/^(\/pl)+(?=\/|$)/, "") || "/"
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
