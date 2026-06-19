"use client"
import React, { useRef, memo, useCallback, useState, useEffect } from "react"
import Navbar from "./nav"
import MainText from "./mainText"
import Layout from "./layout"
import { handleScroll, ScrollToTop } from "./scrollToTop/scroll"
import Landing from "./landing"
import BandTeaser from "./bandTeaser"
import Showcase from "./showcase"
import Portfolio from "./portfolio/portfolio"
import Spotify from "./spotify/spotify"
import Shows from "./shows/shows"
import Newsletter from "./newsletter"
import Contact from "./contact"

const ScrollArrows = memo(({ onClick }) => (
  <button
    onClick={onClick}
    aria-label="Scroll to content"
    className="absolute left-1/2 -translate-x-1/2 bottom-5 p-0 bg-transparent border-0 cursor-pointer"
  >
    <svg className="arrows" aria-hidden="true">
        <path className="a1" d="M0 0 L30 32 L60 0"></path>
        <path className="a2" d="M0 20 L30 52 L60 20"></path>
        <path className="a3" d="M0 40 L30 72 L60 40"></path>
    </svg>
  </button>
))

const PageClient = () => {
    const aboutRef = useRef(null)
    const musicRef = useRef(null)
    const showsRef = useRef(null)
    const contactRef = useRef(null)
    const [activeSection, setActiveSection] = useState(null)

  const scrollToContent = useCallback(
    () => handleScroll(aboutRef.current),
    []
  )

  useEffect(() => {
    const sections = [
      [musicRef, "music"],
      [showsRef, "shows"],
      [contactRef, "contact"],
    ]
    // IntersectionObserver instead of a scroll handler: no per-frame
    // getBoundingClientRect (forced reflow). A section is active while it
    // occupies the band from 150px below the top down to ~45% of the viewport;
    // when several overlap, the topmost in document order wins.
    const idByEl = new Map()
    const visible = new Set()

    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          const id = idByEl.get(e.target)
          if (!id) return
          if (e.isIntersecting) visible.add(id)
          else visible.delete(id)
        })
        let activeId = null
        for (const [, id] of sections) {
          if (visible.has(id)) {
            activeId = id
            break
          }
        }
        setActiveSection(activeId)
      },
      { rootMargin: "-150px 0px -55% 0px", threshold: 0 }
    )

    sections.forEach(([ref, id]) => {
      if (ref.current) {
        idByEl.set(ref.current, id)
        io.observe(ref.current)
      }
    })

    return () => io.disconnect()
  }, [])

    return (
        <>
            <header className="header relative lg:overflow-hidden min-h-screen flex flex-col">
                <Landing />
        <Navbar
          displayLinks={true}
          activePage="home"
          activeSection={activeSection}
          musicRef={musicRef}
          showsRef={showsRef}
          contactRef={contactRef}
        />
                <MainText musicRef={musicRef} contactRef={contactRef} />
                <ScrollArrows onClick={scrollToContent} />
            </header>
            <Layout>
                <ScrollToTop smooth />
        <section ref={aboutRef} className="scroll-mt-20">
          <BandTeaser />
        </section>
        <Showcase />
        <section ref={musicRef} className="scroll-mt-20">
          <Portfolio />
          <Spotify />
        </section>
        <section ref={showsRef} className="scroll-mt-20">
          <Shows />
        </section>
        <section ref={contactRef} className="scroll-mt-20">
          <Newsletter />
          <Contact />
        </section>
            </Layout>
        </>
    )
}

export default PageClient
