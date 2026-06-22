"use client"
import React, { useEffect, useRef } from "react"

const Landing = () => {
  const videoRef = useRef(null)

  // React doesn't reliably set the `muted` DOM *property* from the JSX attribute,
  // so Firefox can treat the video as un-muted and block muted-autoplay (Chrome is
  // lenient) — leaving a blank/grey hero. Force muted + play() on mount.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = true
    const p = v.play()
    if (p && typeof p.catch === "function") p.catch(() => {})
  }, [])

  return (
    <div className="absolute inset-0 -z-100">
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        poster="/poster.webp"
        preload="metadata"
        id="landingvid"
        aria-label="Background video"
        className="lg:w-auto lg:min-w-full lg:min-h-full lg:max-w-none object-cover h-full w-full"
      >
        {/* mp4 (H.264) first: universally decodable, so Firefox never gets stuck on
            a webm it can't fall back from. webm second as a smaller progressive option. */}
        <source src="/rise.mp4" type="video/mp4" />
        <source src="/rise.webm" type="video/webm" />
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
