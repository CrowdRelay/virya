"use client"
import React, { useRef, memo, useCallback } from 'react'
import Navbar from './nav'
import MainText from './mainText'
import Layout from './layout'
import { handleScroll, ScrollToTop } from './scrollToTop/scroll'

const ScrollArrows = memo(({ onClick }) => (
    <svg onClick={onClick} className="arrows cursor-pointer">
        <path className="a1" d="M0 0 L30 32 L60 0"></path>
        <path className="a2" d="M0 20 L30 52 L60 20"></path>
        <path className="a3" d="M0 40 L30 72 L60 40"></path>
    </svg>
))

const PageClient = ({ landing, portfolio, music, shows, contact }) => {
    const portfolioRef = useRef(null)
    const musicRef = useRef(null)
    const showsRef = useRef(null)
    const contactRef = useRef(null)

    const scrollToPortfolio = useCallback(() => handleScroll(portfolioRef.current), [])

    return (
        <>
            <header className="header relative lg:overflow-hidden min-h-screen flex flex-col">
                {landing}
                <Navbar displayLinks={true} portfolioRef={portfolioRef} musicRef={musicRef} showsRef={showsRef} contactRef={contactRef} />
                <MainText contactRef={contactRef} />
                <ScrollArrows onClick={scrollToPortfolio} />
            </header>
            <Layout>
                <ScrollToTop smooth />
                <section ref={portfolioRef} className="scroll-mt-20">{portfolio}</section>
                <section ref={musicRef} className="scroll-mt-20">{music}</section>
                <section ref={showsRef} className="scroll-mt-20">{shows}</section>
                <section ref={contactRef} className="scroll-mt-20">{contact}</section>
            </Layout>
        </>
    )
}

export default PageClient
