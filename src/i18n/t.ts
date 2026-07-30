import { translations, DEFAULT_LANG } from "./translations"

export type Lang = "en" | "pl"

type TranslationFunction = (params?: unknown) => unknown

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const readPath = (root: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>(
    (current, segment) => (isRecord(current) ? current[segment] : undefined),
    root,
  )

const dictionaries = translations as unknown as Record<Lang, unknown>

const resolve = (lang: Lang, key: string, params?: unknown): string => {
  const selected = dictionaries[lang] ?? dictionaries[DEFAULT_LANG]
  const fallback = dictionaries[DEFAULT_LANG]
  const resolved = readPath(selected, key) ?? readPath(fallback, key)

  if (typeof resolved === "function") {
    const value = (resolved as TranslationFunction)(params)
    return typeof value === "string" ? value : key
  }
  return typeof resolved === "string" ? resolved : key
}

export const t = (lang: Lang, key: string, params?: unknown): string =>
  resolve(lang, key, params)

export const lp = (lang: Lang, path: string): string => {
  const clean = String(path || "/").replace(/^(\/pl)+(?=\/|$)/, "") || "/"
  if (lang !== "pl") return clean
  return clean === "/" ? "/pl/" : `/pl${clean}`
}
