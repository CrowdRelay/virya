import { translations, DEFAULT_LANG } from "./translations"

export type Lang = "en" | "pl"

const resolve = (lang: Lang, key: string, params?: unknown): string => {
  const dict = (translations as Record<string, any>)[lang] ?? (translations as Record<string, any>)[DEFAULT_LANG]
  let val = key.split(".").reduce((o: any, k) => o?.[k], dict)
  if (val == null) {
    val = key.split(".").reduce((o: any, k) => o?.[k], (translations as Record<string, any>)[DEFAULT_LANG])
  }
  if (typeof val === "function") return val(params)
  return val ?? key
}

export const t = (lang: Lang, key: string, params?: unknown): string =>
  resolve(lang, key, params)

export const lp = (lang: Lang, path: string): string => {
  const clean = String(path || "/").replace(/^(\/pl)+(?=\/|$)/, "") || "/"
  if (lang !== "pl") return clean
  return clean === "/" ? "/pl/" : `/pl${clean}`
}
