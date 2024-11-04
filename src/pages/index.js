"use client"
import React, {useRef} from "react"
import Landing from '../components/landing'
import Contact from "../components/contact"
import Layout from "../components/layout"
import Navbar from "../components/nav"
import MainText from "../components/mainText"
import Portfolio from "../components/portfolio/portfolio"
import { handleScroll, ScrollToTop } from "../components/scrollToTop/scroll"
import Shows from "../components/shows/shows"

const Main = () => {
    const portfolioRef = useRef(null);
    const showsRef = useRef(null);
    const contactRef = useRef(null);

    return (
        <>
            <header className="header relative lg:overflow-hidden">
                <Landing />
                <Navbar displayLinks={true} portfolioRef={portfolioRef} showsRef={showsRef} contactRef={contactRef} />
                <MainText contactRef={contactRef} />
                <svg onClick={() => handleScroll(portfolioRef.current)} className="arrows cursor-pointer">
                    <path className="a1" d="M0 0 L30 32 L60 0"></path>
                    <path className="a2" d="M0 20 L30 52 L60 20"></path>
                    <path className="a3" d="M0 40 L30 72 L60 40"></path>
                </svg>
            </header>
            <Layout>
                <ScrollToTop smooth />
                <section ref={portfolioRef}><Portfolio /></section>
                <section ref={showsRef}><Shows /></section>
                <section ref={contactRef}><Contact /></section>
            </Layout>
        </>
    )
}

export const Head = () => {
    return (
        <>
            <title>Virya | Modern metalcore from Poland</title>
            <link rel="canonical" href="https://www.virya.music" />
            <meta name="description"
                content="A website of Virya, a new modern metalcore powerhorse from Poland. Check out the latest releases and news." />
            <meta name="og:title" content='Virya | Modern metalcore from Poland' />
            <meta name="og:image" content='https://www.virya.music/virya.webp' />
            <meta name="og:url" content="https://www.virya.music" />
            <meta name="og:type" content='website' />
            <meta name="og:description"
                content="A website of Virya, a new modern metalcore powerhorse from Poland. Check out the latest releases and news." />
            <meta name="keywords"
                content='Virya, Music, Band, Metalcore, Modern Metal, Modern Metalcore, Heavy, Melodic, Virtuoso, Alternative' />
            <meta name="facebook:card" content="summary" />
            <meta name="facebook:creator" content="ViryaBand" />
            <meta name="facebook:title" content='Virya | Modern metalcore from Poland' />
            <meta name="facebook:description"
                content="A website of Virya, a new modern metalcore powerhorse from Poland. Check out the latest releases and news." />
            <meta name="facebook:image" content="https://www.virya.music/virya.webp" />
            <meta name="facebook:url" content="https://www.virya.music" />
            <meta name="twitter:card" content="summary" />
            <meta name="twitter:title" content='Virya | Modern metalcore from Poland' />
            <meta name="twitter:url" content="https://www.virya.music" />
            <meta name="twitter:description"
                content="A website of Virya, a new modern metalcore powerhorse from Poland. Check out the latest releases and news." />
            <meta name="twitter:image" content="https://www.virya.music/virya.webp" />
            <meta name="twitter:creator" content="viryaofficial" />
        </>
    )
}

export default Main
