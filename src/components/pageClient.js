"use client"
import React, { useRef, memo, useCallback } from "react"
import Navbar from "./nav"
import MainText from "./mainText"
import Layout from "./layout"
import { handleScroll, ScrollToTop } from "./scrollToTop/scroll"
import Landing from "./landing"
import Portfolio from "./portfolio/portfolio"
import Spotify from "./spotify/spotify"
import Shows from "./shows/shows"
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
  const portfolioRef = useRef(null)
  const musicRef = useRef(null)
  const showsRef = useRef(null)
  const contactRef = useRef(null)

  const scrollToPortfolio = useCallback(
    () => handleScroll(portfolioRef.current),
    []
  )

  return (
    <>
      <header className="header relative lg:overflow-hidden h-screen lg:min-h-screen flex flex-col">
        <Landing />
        <Navbar
          displayLinks={true}
          portfolioRef={portfolioRef}
          musicRef={musicRef}
          showsRef={showsRef}
          contactRef={contactRef}
        />
        <MainText contactRef={contactRef} />
        <ScrollArrows onClick={scrollToPortfolio} />
      </header>
      <Layout>
        <ScrollToTop smooth />
        <section ref={portfolioRef} className="scroll-mt-20">
          <Portfolio />
        </section>
        <section ref={musicRef} className="scroll-mt-20">
          <Spotify />
        </section>
        <section ref={showsRef} className="scroll-mt-20">
          <Shows />
        </section>
        <section ref={contactRef} className="scroll-mt-20">
          <Contact />
        </section>
      </Layout>
    </>
  )
}

export default PageClient
