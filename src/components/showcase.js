"use client"
import React, { memo, useState } from "react"

const POSTER = "/showcase-poster.jpg"
const VIDEO = "/showcase-web.mp4"

const Showcase = memo(() => {
  const [playing, setPlaying] = useState(false)

  return (
    <div className="py-16 lg:px-8 border-t border-zinc-800/60">
      <div className="mx-4">
        <div className="flex items-center gap-4 mb-2">
          <p className="text-3xl font-black uppercase tracking-widest whitespace-nowrap text-white">
            Showcase
          </p>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>
        <p className="text-zinc-400 text-xs uppercase tracking-widest mb-8">
          Virya in 2026
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
              aria-label="Virya 2026 showcase video"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label="Play the Virya 2026 showcase video"
              className="group block w-full h-full"
            >
              <img
                src={POSTER}
                alt="Virya — 2026 showcase"
                width={720}
                height={720}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-80"
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
