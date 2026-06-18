"use client"
import React, { useRef, useEffect } from "react"

const Landing = () => {
  // Keep a single <video> element that shows its poster (the preloaded LCP)
  // from the very first paint — no img→video swap, so the framing never
  // jumps. We just defer the video bytes off the critical path: with
  // preload="none" and no autoPlay the browser only renders the poster, then
  // we call play() once the browser is idle, which loads and starts it.
  const ref = useRef(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const start = () => {
      ref.current?.play().catch(() => {})
    }
    let id
    if ("requestIdleCallback" in window) {
      id = window.requestIdleCallback(start, { timeout: 2500 })
      return () => window.cancelIdleCallback(id)
    }
    id = window.setTimeout(start, 1200)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div className="absolute inset-0 -z-100">
      <video
        ref={ref}
        className="lg:w-auto lg:min-w-full lg:min-h-full lg:max-w-none object-cover h-full w-full"
        muted
        loop
        playsInline
        poster="/poster.webp"
        preload="none"
        id="landingvid"
        aria-label="Background video"
      >
        <source src="/rise.webm" type="video/webm" />
        <source src="/rise.mp4" type="video/mp4" />
        <track
          src="/captions_en.vtt"
          kind="captions"
          srcLang="en"
          label="English captions"
          default
        />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
    </div>
  )
}

export default Landing
