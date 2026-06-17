"use client"
import React, { memo } from "react"
import { Link } from "gatsby"
import { handleScroll } from "./scrollToTop/scroll"
import { useI18n } from "../i18n/I18nContext"

const YOUTUBE_VIDEOS = "http://youtube.com/@ViryaOfficial/videos"

const MainText = memo(({ musicRef, contactRef }) => {
  const { t, lp } = useI18n()
  return (
    <div className="container lg:max-w-4xl my-auto lg:px-20 px-6 py-4">
      <div className="border-l-4 border-amber-400 pl-6 lg:pl-8 mt-20 md:mt-48 lg:mt-0 lg:mb-48 mb-16 py-2">
        <p className="uppercase tracking-[0.3em] text-amber-400 text-xs font-bold mb-4">
          {t("hero.eyebrow")}
        </p>
        <h1 className="m-0 [text-shadow:0_2px_24px_rgba(0,0,0,0.9)]">
          <span className="block lg:text-7xl md:text-5xl text-4xl font-black tracking-tight leading-none text-white uppercase">
            {t("hero.title")}
          </span>
          <span className="block lg:text-2xl md:text-xl text-base font-semibold tracking-wide text-zinc-300 mt-2 normal-case">
            {t("hero.subtitle")}
          </span>
        </h1>
        <p className="lg:text-base text-sm text-justify mt-6 text-zinc-300 max-w-lg leading-relaxed [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
          {t("hero.body")}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={() => handleScroll(musicRef.current)}
            className="flex-1 inline-flex items-center justify-center min-h-[44px] px-3 lg:px-6 bg-amber-400 text-black hover:bg-amber-300 uppercase tracking-widest font-bold text-xs transition-colors"
            aria-label={t("hero.listenAria")}
          >
            {t("hero.listen")}
          </button>
          <a
            href={YOUTUBE_VIDEOS}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center min-h-[44px] px-3 lg:px-6 border border-amber-400/60 text-amber-400 hover:bg-amber-400 hover:text-black uppercase tracking-widest font-bold text-xs transition-colors"
          >
            {t("hero.watch")}
          </a>
          <Link
            to={lp("/merch")}
            className="flex-1 inline-flex items-center justify-center min-h-[44px] px-3 lg:px-6 border border-zinc-500/60 text-zinc-200 hover:border-amber-400 hover:text-amber-400 uppercase tracking-widest font-bold text-xs transition-colors"
          >
            {t("hero.merch")}
          </Link>
        </div>

        <p className="text-xs mt-6 text-zinc-400 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
          {t("hero.bookingQ")}{" "}
          <button
            onClick={() => handleScroll(contactRef.current)}
            className="text-amber-400 hover:text-amber-200 transition-colors underline underline-offset-2"
          >
            {t("hero.getInTouch")}
          </button>
          .
        </p>
      </div>
    </div>
  )
})

export default MainText
