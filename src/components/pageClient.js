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
      { ref: musicRef, id: "music" },
      { ref: showsRef, id: "shows" },
      { ref: contactRef, id: "contact" },
    ]

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSections = entries
          .filter(entry => entry.isIntersecting)
          .map(entry => {
            const section = sections.find(s => s.ref.current === entry.target)
            return section?.id
          })
          .filter(Boolean)

        if (visibleSections.length > 0) {
          setActiveSection(visibleSections[0])
        } else {
          setActiveSection(null)
        }
      },
      { threshold: 0.1, rootMargin: "-80px 0px -60% 0px" }
    )

    sections.forEach(({ ref }) => {
      if (ref.current) observer.observe(ref.current)
    })

    return () => observer.disconnect()
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
