import { memo, useCallback } from "preact/hooks"
import { LanguageProvider, useI18n } from "../../i18n/I18nContext"

const MainTextInner = () => {
  const { t, lp } = useI18n()

  const scrollTo = useCallback((id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  return (
    <div class="relative z-10 flex-1 flex flex-col justify-center items-center text-center px-6 py-20 lg:py-32">
      <p class="text-xs font-bold uppercase tracking-[0.4em] text-amber-400 mb-4">
        {t("hero.eyebrow")}
      </p>
      <h1 class="text-4xl lg:text-6xl font-black uppercase tracking-tight text-white mb-4 leading-none">
        Virya
      </h1>
      <p class="text-sm lg:text-base text-zinc-300 uppercase tracking-widest mb-10 max-w-md">
        {t("hero.sub")}
      </p>
      <div class="flex flex-wrap justify-center gap-3">
        <button
          onClick={() => scrollTo("music")}
          class="text-[11px] font-bold uppercase tracking-widest px-6 py-3 bg-amber-400 text-black hover:bg-amber-300 transition-colors duration-200"
        >
          {t("hero.listenCta")}
        </button>
        <button
          onClick={() => scrollTo("shows")}
          class="text-[11px] font-bold uppercase tracking-widest px-6 py-3 border border-zinc-100/30 text-zinc-100 hover:border-amber-400 hover:text-amber-400 transition-colors duration-200"
        >
          {t("hero.showsCta")}
        </button>
        <a
          href={lp("/merch")}
          class="text-[11px] font-bold uppercase tracking-widest px-6 py-3 border border-zinc-100/30 text-zinc-100 hover:border-amber-400 hover:text-amber-400 transition-colors duration-200"
        >
          {t("hero.merchCta")}
        </a>
      </div>
    </div>
  )
}

const MainText = ({ lang }) => (
  <LanguageProvider initialLang={lang}>
    <MainTextInner />
  </LanguageProvider>
)

export default MainText
