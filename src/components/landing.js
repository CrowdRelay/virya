"use client"
import React from "react"

const Landing = () => (
  <div className="absolute inset-0 -z-100">
    <img
      src="/poster.webp"
      alt=""
      aria-hidden="true"
      fetchpriority="high"
      className="absolute inset-0 object-cover h-full w-full"
    />
    <video
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      id="landingvid"
      aria-label="Background video"
      style={{ opacity: 0, transition: "opacity 0.5s" }}
      onPlaying={e => { e.currentTarget.style.opacity = "1" }}
      className="absolute inset-0 lg:w-auto lg:min-w-full lg:min-h-full lg:max-w-none object-cover h-full w-full"
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

export default Landing
