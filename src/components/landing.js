"use client"
import React, { useState, useEffect } from "react"

const Landing = () => {
  // Defer the background video off the critical path: the preloaded poster
  // paints immediately (it's the LCP), then we mount the heavy <video> once
  // the browser is idle so it never competes with first paint / hydration.
  const [showVideo, setShowVideo] = useState(false)

  useEffect(() => {
    let id
    if (typeof window === "undefined") return
    if ("requestIdleCallback" in window) {
      id = window.requestIdleCallback(() => setShowVideo(true), { timeout: 2500 })
      return () => window.cancelIdleCallback(id)
    }
    id = window.setTimeout(() => setShowVideo(true), 1200)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div className="absolute inset-0 -z-100">
      {showVideo ? (
        <video
          className="lg:w-auto lg:min-w-full lg:min-h-full lg:max-w-none object-cover h-full w-full"
          autoPlay
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
      ) : (
        <img
          src="/poster.webp"
          alt=""
          aria-hidden="true"
          className="object-cover h-full w-full"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
    </div>
  )
}

export default Landing
