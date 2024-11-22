"use client"
import React, { useRef, memo } from "react"
import Landing from '../components/landing'
import Contact from "../components/contact"
import Layout from "../components/layout"
import Navbar from "../components/nav"
import MainText from "../components/mainText"
import Portfolio from "../components/portfolio/portfolio"
import { handleScroll, ScrollToTop } from "../components/scrollToTop/scroll"
import Shows from "../components/shows/shows"

const ScrollArrows = memo(({ onClick }) => (
  <svg onClick={onClick} className="arrows cursor-pointer">
    <path className="a1" d="M0 0 L30 32 L60 0"></path>
    <path className="a2" d="M0 20 L30 52 L60 20"></path>
    <path className="a3" d="M0 40 L30 72 L60 40"></path>
  </svg>
));

const Main = () => {
    const portfolioRef = useRef(null);
    const showsRef = useRef(null);
    const contactRef = useRef(null);

    const scrollToPortfolio = () => handleScroll(portfolioRef.current);

    return (
        <>
            <header className="header relative lg:overflow-hidden">
                <Landing />
                <Navbar displayLinks={true} portfolioRef={portfolioRef} showsRef={showsRef} contactRef={contactRef} />
                <MainText contactRef={contactRef} />
                <ScrollArrows onClick={scrollToPortfolio} />
            </header>
            <Layout>
                <ScrollToTop smooth />
                <section ref={portfolioRef}><Portfolio /></section>
                <section ref={showsRef}><Shows /></section>
                <section ref={contactRef}><Contact /></section>
            </Layout>
        </>
    )
};

const metaTags = {
    title: 'Virya | Modern metalcore from Poland',
    description: "A website of Virya, a new modern metalcore powerhorse from Poland. Check out the latest releases and news.",
    image: 'https://www.virya.music/virya.webp',
    url: 'https://www.virya.music',
    keywords: 'Virya, Music, Band, Metalcore, Modern Metal, Modern Metalcore, Heavy, Melodic, Virtuoso, Alternative'
};

export const Head = () => {
    return (
        <>
            <title>{metaTags.title}</title>
            <link rel="canonical" href={metaTags.url} />
            <meta name="description" content={metaTags.description} />
            <meta name="og:title" content={metaTags.title} />
            <meta name="og:image" content={metaTags.image} />
            <meta name="og:url" content={metaTags.url} />
            <meta name="og:type" content='website' />
            <meta name="og:description" content={metaTags.description} />
            <meta name="keywords" content={metaTags.keywords} />
            <meta name="facebook:card" content="summary" />
            <meta name="facebook:creator" content="ViryaBand" />
            <meta name="facebook:title" content={metaTags.title} />
            <meta name="facebook:description" content={metaTags.description} />
            <meta name="facebook:image" content={metaTags.image} />
            <meta name="facebook:url" content={metaTags.url} />
            <meta name="twitter:card" content="summary" />
            <meta name="twitter:title" content={metaTags.title} />
            <meta name="twitter:url" content={metaTags.url} />
            <meta name="twitter:description" content={metaTags.description} />
            <meta name="twitter:image" content={metaTags.image} />
            <meta name="twitter:creator" content="viryaofficial" />
        </>
    )
};

export default memo(Main);
