"use client"
import React, { useState, useEffect, useRef, memo } from 'react'
import { handleScroll } from './scrollToTop/scroll'
import { StaticImage } from 'gatsby-plugin-image'
import { Link } from 'gatsby'
import { useI18n } from '../i18n/I18nContext'
import LangSwitch from './langSwitch'

const linkClass = "cursor-pointer lg:px-4 px-3 py-3 lg:py-2 text-xs font-semibold uppercase tracking-widest transition duration-300 ease-in-out"
const activeLinkClass = "text-amber-400"
const inactiveLinkClass = "text-zinc-400 hover:text-amber-400"

const NavLink = memo(({ onClick, title, children, active }) => (
  <button
    onClick={onClick}
    className={`cursor-pointer lg:px-4 px-2 py-2 text-xs font-semibold uppercase tracking-widest transition duration-300 ease-in-out ${active ? "text-amber-400" : "text-zinc-400 hover:text-amber-400"}`}
    title={title}
  >
    <span>{children}</span>
  </button>
));

const MobileItem = ({ onClick, children, active }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-2 py-4 text-sm font-semibold uppercase tracking-widest border-b border-white/5 transition-colors ${active ? "text-amber-400" : "text-zinc-300 hover:text-amber-400"}`}
  >
    {children}
  </button>
);

const Navbar = ({ displayLinks, activePage, activeSection, musicRef, showsRef, contactRef }) => {
  const { t, lp } = useI18n()
  const [headerStyle, setHeaderStyle] = useState({
    transition: 'all 200ms ease-in'
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && !event.target.closest('button[aria-controls="mobile-menu"]')) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)
  const scrollAndClose = ref => () => {
    handleScroll(ref?.current)
    closeMenu()
  }

  return (
    <nav aria-label="Main navigation" style={{ ...headerStyle }} className="fixed top-0 right-0 left-0 p-3 z-20 backdrop-blur-md bg-black/70 border-b border-white/5">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-400 focus:text-black focus:text-xs focus:font-bold focus:uppercase focus:tracking-widest"
      >
        {t("nav.skip")}
      </a>
      <div className="container mx-auto flex items-center">
        <div className="flex flex-1 items-center">
          <Link title={t("nav.home")} className={`group flex my-2 cursor-pointer ${activePage === "home" ? "ring-amber-400" : ""}`} to={lp("/")}>
            <StaticImage
              src="../images/virya.webp"
              title="Virya"
              loading="eager"
              alt="Virya"
              placeholder="none"
              width={100}
              height={100}
              quality={90}
              className={`!w-[50px] !h-[50px] rounded-full ring-2 ring-offset-2 ring-offset-black transition-all duration-300 group-hover:ring-amber-400 group-hover:scale-110 group-hover:brightness-125 group-hover:shadow-[0_0_12px_rgba(251,191,36,0.5)] ${activePage === "home" ? "ring-amber-400" : "ring-amber-400/40"}`}
            />
          </Link>
        </div>

        <div className="hidden lg:flex items-center">
          {displayLinks && <Link to={lp("/about")} className={`${linkClass} ${activePage === "about" ? activeLinkClass : inactiveLinkClass}`}>{t("nav.band")}</Link>}
          {displayLinks && <Link to={lp("/merch")} className={`${linkClass} ${activePage === "merch" ? activeLinkClass : inactiveLinkClass}`}>{t("nav.merch")}</Link>}
          {displayLinks && <Link to={lp("/epk")} className={`${linkClass} ${activePage === "epk" ? activeLinkClass : inactiveLinkClass}`}>{t("nav.epk")}</Link>}
          {displayLinks && activePage === "home" && (
            <>
              <NavLink onClick={() => handleScroll(musicRef.current)} title={t("nav.music")} active={activeSection === "music"}>{t("nav.music")}</NavLink>
              <NavLink onClick={() => handleScroll(showsRef.current)} title={t("nav.shows")} active={activeSection === "shows"}>{t("nav.shows")}</NavLink>
              <NavLink onClick={() => handleScroll(contactRef.current)} title={t("nav.contact")} active={activeSection === "contact"}>{t("nav.contact")}</NavLink>
            </>
          )}
          <LangSwitch className="ml-4 pl-4 border-l border-white/10" />
        </div>

        <div className="flex lg:hidden items-center gap-2">
          <LangSwitch className="mr-1" />
          {displayLinks && activePage === "home" && (
            <Link
              to={lp("/merch")}
              aria-label={t("nav.toMerch")}
              className="inline-flex items-center min-h-[44px] px-3 text-xs font-bold uppercase tracking-widest text-amber-400 border border-amber-400/50 hover:bg-amber-400 hover:text-black transition-colors"
            >
              {t("nav.merch")}
            </Link>
          )}
          {displayLinks && (
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
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

      {displayLinks && menuOpen && (
        <div ref={menuRef} id="mobile-menu" className="lg:hidden container mx-auto mt-3 pt-1 border-t border-white/10 flex flex-col">
          <Link to={lp("/about")} onClick={closeMenu} className={`w-full text-left px-2 py-4 text-sm font-semibold uppercase tracking-widest border-b border-white/5 transition-colors ${activePage === "about" ? "text-amber-400" : "text-zinc-300 hover:text-amber-400"}`}>
            {t("nav.band")}
          </Link>
          <Link to={lp("/merch")} onClick={closeMenu} className={`w-full text-left px-2 py-4 text-sm font-semibold uppercase tracking-widest border-b border-white/5 transition-colors ${activePage === "merch" ? "text-amber-400" : "text-zinc-300 hover:text-amber-400"}`}>
            {t("nav.merch")}
          </Link>
          <Link to={lp("/epk")} onClick={closeMenu} className={`w-full text-left px-2 py-4 text-sm font-semibold uppercase tracking-widest border-b border-white/5 transition-colors ${activePage === "epk" ? "text-amber-400" : "text-zinc-300 hover:text-amber-400"}`}>
            {t("nav.epk")}
          </Link>
          {activePage === "home" && (
            <>
              <MobileItem onClick={scrollAndClose(musicRef)} active={activeSection === "music"}>{t("nav.music")}</MobileItem>
              <MobileItem onClick={scrollAndClose(showsRef)} active={activeSection === "shows"}>{t("nav.shows")}</MobileItem>
              <MobileItem onClick={scrollAndClose(contactRef)} active={activeSection === "contact"}>{t("nav.contact")}</MobileItem>
            </>
          )}
        </div>
      )}
    </nav>
  )
}

export default memo(Navbar);
