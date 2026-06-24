import { useI18n, localePath } from "../../i18n/I18nContext"

const LangSwitch = () => {
  const { lang } = useI18n()

  const switchTo = (targetLang) => {
    if (typeof window === "undefined") return
    const currentPath = window.location.pathname
    const newPath = localePath(currentPath, targetLang)
    try {
      window.localStorage.setItem("virya-lang", targetLang)
    } catch {
      /* ignore */
    }
    window.location.href = newPath + window.location.search + window.location.hash
  }

  return (
    <div class="flex items-center gap-1 text-xs font-bold uppercase tracking-widest">
      <button
        onClick={() => switchTo("en")}
        class={`px-1.5 py-1 transition-colors ${lang === "en" ? "text-amber-400" : "text-zinc-500 hover:text-zinc-100"}`}
        aria-label="Switch to English"
        aria-current={lang === "en" ? "true" : undefined}
      >
        EN
      </button>
      <span class="text-zinc-700">/</span>
      <button
        onClick={() => switchTo("pl")}
        class={`px-1.5 py-1 transition-colors ${lang === "pl" ? "text-amber-400" : "text-zinc-500 hover:text-zinc-100"}`}
        aria-label="Przełącz na polski"
        aria-current={lang === "pl" ? "true" : undefined}
      >
        PL
      </button>
    </div>
  )
}

export default LangSwitch
