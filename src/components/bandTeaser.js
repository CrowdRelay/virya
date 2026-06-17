"use client"
import React, { memo } from "react"
import { Link } from "gatsby"
import { StaticImage } from "gatsby-plugin-image"
import { useI18n } from "../i18n/I18nContext"

const BandTeaser = memo(() => {
  const { t, lang } = useI18n()
  const prefix = lang === "pl" ? "/pl" : ""
  return (
  <div className="py-16 lg:px-8 border-t border-zinc-800/60">
    <div className="mx-4">
      <div className="flex items-center gap-4 mb-2">
        <p className="text-3xl font-black uppercase tracking-widest whitespace-nowrap text-white">
          {t("band.heading")}
        </p>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      <p className="text-zinc-400 text-xs uppercase tracking-widest mb-8">
        {t("band.sub")}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="overflow-hidden border border-zinc-800/60">
          <StaticImage
            src="../images/band.webp"
            alt="Virya — modern metalcore band from Poland"
            title="Virya"
            placeholder="blurred"
            loading="lazy"
            width={760}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="w-full h-full"
          />
        </div>
        <div className="border-l-4 border-amber-400 pl-6 lg:pl-8 py-2">
          <p className="lg:text-base text-sm text-zinc-300 text-justify leading-relaxed">
            {t("band.teaser")}
          </p>
          <p className="mt-4 text-sm text-zinc-400 leading-relaxed">
            {t("band.noPain")}
          </p>
          <Link
            to={`${prefix}/band`}
            className="inline-flex items-center gap-2 mt-6 text-xs font-bold uppercase tracking-widest text-amber-400 hover:text-amber-200 transition-colors"
          >
            {t("band.readStory")}
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  </div>
  )
})

export default BandTeaser
