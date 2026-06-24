import { useEffect, useRef } from "preact/hooks"

const Landing = () => {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = true
    const play = () => {
      video.play().catch(() => {
        video.muted = true
        video.play().catch(() => {})
      })
    }
    if (video.readyState >= 2) {
      play()
    } else {
      video.addEventListener("canplay", play, { once: true })
    }
  }, [])

  return (
    <div class="absolute inset-0 z-0 overflow-hidden">
      <video
        ref={videoRef}
        class="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        poster="/poster.webp"
        preload="metadata"
        aria-hidden="true"
      >
        <source src="/rise.webm" type="video/webm" />
        <source src="/rise.mp4" type="video/mp4" />
        <track kind="captions" src="/captions_en.vtt" srcLang="en" label="English" />
      </video>
      <div class="absolute inset-0 bg-black/60" aria-hidden="true" />
    </div>
  )
}

export default Landing
