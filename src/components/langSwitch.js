"use client"
import React from "react"
import { navigate } from "gatsby"
import { useI18n, localePath } from "../i18n/I18nContext"
import { LANGS } from "../i18n/translations"

const LABELS = { en: "EN", pl: "PL" }
const NAMES = { en: "English", pl: "Polski" }

const LangSwitch = ({ className = "" }) => {
  const { lang, t } = useI18n()

  const go = target => {
    if (target === lang || typeof window === "undefined") return
    const { pathname, search, hash } = window.location
    navigate(`${localePath(pathname, target)}${search}${hash}`)
  }

  return (
    <div
      role="group"
      aria-label={t("nav.language")}
      className={`inline-flex items-center text-xs font-bold uppercase tracking-widest ${className}`}
    >
      {LANGS.map((l, i) => (
        <React.Fragment key={l}>
          {i > 0 && (
            <span aria-hidden="true" className="text-zinc-600 mx-1.5">
              /
            </span>
          )}
          <button
            type="button"
            onClick={() => go(l)}
            aria-pressed={lang === l}
            title={NAMES[l]}
            className={`transition-colors ${
              lang === l
                ? "text-amber-400"
                : "text-zinc-400 hover:text-amber-200"
            }`}
          >
            {LABELS[l]}
          </button>
        </React.Fragment>
      ))}
    </div>
  )
}

export default LangSwitch
