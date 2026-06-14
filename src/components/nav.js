"use client"
import React, { useState, useEffect, memo } from 'react'
import { handleScroll } from './scrollToTop/scroll'
import { StaticImage } from 'gatsby-plugin-image'
import { Link } from 'gatsby'

const linkClass = "cursor-pointer lg:px-4 px-3 py-3 lg:py-2 text-xs font-semibold uppercase tracking-widest transition duration-300 ease-in-out text-zinc-400 hover:text-amber-400"

const NavLink = memo(({ onClick, title, children }) => (
  <button
    onClick={onClick}
    className="cursor-pointer lg:px-4 px-2 py-2 text-xs font-semibold uppercase tracking-widest transition duration-300 ease-in-out text-zinc-400 hover:text-amber-400"
    title={title}
  >
    <span>{children}</span>
  </button>
));

// Larger, full-width row used inside the mobile hamburger dropdown.
const MobileItem = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="w-full text-left px-2 py-4 text-sm font-semibold uppercase tracking-widest text-zinc-300 hover:text-amber-400 border-b border-white/5 transition-colors"
  >
    {children}
  </button>
);

const Navbar = ({ displayLinks, portfolioRef, musicRef, showsRef, contactRef }) => {
  const [headerStyle, setHeaderStyle] = useState({
    transition: 'all 200ms ease-in'
  })
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let lastY = window.scrollY
    let timeoutId = null

    const onScroll = () => {
      if (timeoutId) return
      timeoutId = setTimeout(() => {
        const currY = window.scrollY
        const isVisible = currY < lastY
        setHeaderStyle(prev => {
          const next = {
            visibility: isVisible ? 'visible' : 'hidden',
            transition: `all 200ms ${isVisible ? 'ease-in' : 'ease-out'}`,
            transform: isVisible ? 'none' : 'translate(0, -100%)'
          }
          return JSON.stringify(next) === JSON.stringify(prev) ? prev : next
        })
        if (!isVisible) setMenuOpen(false)
        lastY = currY
        timeoutId = null
      }, 200)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  const closeMenu = () => setMenuOpen(false)
  const scrollAndClose = ref => () => {
    handleScroll(ref?.current)
    closeMenu()
  }

  return (
    <nav aria-label="Main navigation" style={{ ...headerStyle }} className="fixed top-0 right-0 left-0 p-3 z-20 backdrop-blur-md bg-black/70 border-b border-white/5">
      <div className="container mx-auto flex items-center">
        {/* Logo — desktop only */}
        <div className="hidden lg:flex flex-1 items-center">
          <Link title="Homepage" className="flex" to="/">
            <StaticImage
              src="../images/virya.webp"
              title="Virya"
              loading="eager"
              alt="Virya"
              placeholder="blurred"
              width={50}
              height={50}
              className="rounded-full my-2"
            />
          </Link>
        </div>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center">
          {displayLinks && <Link to="/band" className={linkClass}>Band</Link>}
          <Link to="/merch" className={linkClass}>Merch</Link>
          {displayLinks && (
            <>
              <NavLink onClick={() => handleScroll(portfolioRef.current)} title="Portfolio">Portfolio</NavLink>
              <NavLink onClick={() => handleScroll(musicRef.current)} title="Music">Music</NavLink>
              <NavLink onClick={() => handleScroll(showsRef.current)} title="Shows">Shows</NavLink>
              <NavLink onClick={() => handleScroll(contactRef.current)} title="Contact">Contact</NavLink>
            </>
          )}
        </div>

        {/* Mobile: Merch + hamburger */}
        <div className="flex lg:hidden items-center justify-between w-full">
          <Link
            to="/merch"
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-400 border border-amber-400/50 hover:bg-amber-400 hover:text-black transition-colors"
          >
            Merch
          </Link>
          {displayLinks && (
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className="p-2 text-zinc-300 hover:text-amber-400 transition-colors"
            >
              {menuOpen ? (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              ) : (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile dropdown */}
      {displayLinks && menuOpen && (
        <div id="mobile-menu" className="lg:hidden container mx-auto mt-3 pt-1 border-t border-white/10 flex flex-col">
          <Link to="/band" onClick={closeMenu} className="w-full text-left px-2 py-4 text-sm font-semibold uppercase tracking-widest text-zinc-300 hover:text-amber-400 border-b border-white/5 transition-colors">
            Band
          </Link>
          <MobileItem onClick={scrollAndClose(portfolioRef)}>Portfolio</MobileItem>
          <MobileItem onClick={scrollAndClose(musicRef)}>Music</MobileItem>
          <MobileItem onClick={scrollAndClose(showsRef)}>Shows</MobileItem>
          <MobileItem onClick={scrollAndClose(contactRef)}>Contact</MobileItem>
        </div>
      )}
    </nav>
  )
}

export default memo(Navbar);
