"use client"
import React, { memo, useCallback, useEffect, useState } from "react"
import "./style.css"

export const handleScroll = ref => {
  if (!ref) return
  ref.scrollIntoView({ behavior: "smooth", block: "start" })
}

const toTop = (smooth = false) => {
  if (smooth) {
    window.scrollTo({ top: 0, behavior: "smooth" })
  } else {
    document.documentElement.scrollTop = 0
  }
}

export const ScrollToTop = memo(
  ({
    top = 20,
    smooth = false,
    positionClassName = "right-6 bottom-6",
    viewBox = "0 0 256 256",
    svgPath = "M222.138,91.475l-89.6-89.6c-2.5-2.5-6.551-2.5-9.051,0l-89.6,89.6c-2.5,2.5-2.5,6.551,0,9.051s6.744,2.5,9.244,0L122,21.85  V249.6c0,3.535,2.466,6.4,6,6.4s6-2.865,6-6.4V21.85l78.881,78.676c1.25,1.25,2.992,1.875,4.629,1.875s3.326-0.625,4.576-1.875  C224.586,98.025,224.638,93.975,222.138,91.475z",
  }) => {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
      let ticking = false
      const onScroll = () => {
        if (ticking) return
        ticking = true
        requestAnimationFrame(() => {
          setVisible(document.documentElement.scrollTop > top)
          ticking = false
        })
      }
      document.addEventListener("scroll", onScroll, { passive: true })
      return () => document.removeEventListener("scroll", onScroll)
    }, [top])

    const handleClick = useCallback(() => toTop(smooth), [smooth])

    if (!visible) return null

    return (
      <button
        aria-label="Scroll to top"
        className={`z-20 scroll-to-top ${positionClassName} p-2 w-11 h-11 scroll-to-top-small lg:scroll-to-top-big bg-amber-400 hover:bg-amber-300 text-black transition-colors duration-200`}
        onClick={handleClick}
      >
        <svg fill="#1f2936" viewBox={viewBox}>
          <path d={svgPath} />
        </svg>
      </button>
    )
  }
)
