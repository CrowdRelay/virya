"use client"
import React, { memo, useState } from "react"
import { StaticImage } from "gatsby-plugin-image"
import { useI18n } from "../i18n/I18nContext"

const POSTER = "/showcase-poster.jpg"
const VIDEO = "/showcase-web.mp4"

const Showcase = memo(() => {
  const { t } = useI18n()
  const [playing, setPlaying] = useState(false)

  return (
    <div className="py-16 lg:px-8 border-t border-zinc-800/60">
      <div className="mx-4">
        <div className="flex items-center gap-4 mb-2">
          <p className="text-3xl font-black uppercase tracking-widest whitespace-nowrap text-white">
            {t("showcase.heading")}
          </p>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>
        <p className="text-zinc-400 text-xs uppercase tracking-widest mb-8">
          {t("showcase.sub")}
        </p>

        <div className="relative max-w-2xl mx-auto aspect-square overflow-hidden border border-zinc-800/60 bg-zinc-950">
          {playing ? (
            <video
              className="w-full h-full object-cover"
              src={VIDEO}
              poster={POSTER}
              controls
              autoPlay
              playsInline
              preload="none"
              aria-label={t("showcase.play")}
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={t("showcase.play")}
              className="group block w-full h-full"
            >
              <StaticImage
                src="../images/showcase-poster.jpg"
                alt={t("showcase.sub")}
                width={672}
                quality={85}
                placeholder="blurred"
                loading="lazy"
                formats={["auto", "webp", "avif"]}
                sizes="(min-width: 672px) 672px, 100vw"
                className="w-full h-full transition-opacity duration-300 group-hover:opacity-80"
                imgClassName="object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-400 text-black shadow-lg shadow-black/40 transition-transform duration-200 group-hover:scale-110">
                  <svg
                    className="w-6 h-6 ml-1"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

export default Showcase
