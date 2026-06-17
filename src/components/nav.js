"use client"
import React, { useState, useEffect, memo } from 'react'
import { handleScroll } from './scrollToTop/scroll'
import { StaticImage } from 'gatsby-plugin-image'
import { Link } from 'gatsby'
import { useI18n } from '../i18n/I18nContext'
import LangSwitch from './langSwitch'

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

const MobileItem = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="w-full text-left px-2 py-4 text-sm font-semibold uppercase tracking-widest text-zinc-300 hover:text-amber-400 border-b border-white/5 transition-colors"
  >
    {children}
  </button>
);

const Navbar = ({ displayLinks, musicRef, showsRef, contactRef }) => {
  const { t, lp } = useI18n()
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
        <div className="flex flex-1 items-center">
          <Link title={t("nav.home")} className="flex" to={lp("/")}>
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

        <div className="hidden lg:flex items-center">
          {displayLinks && <Link to={lp("/band")} className={linkClass}>{t("nav.band")}</Link>}
          <Link to={lp("/merch")} className={linkClass}>{t("nav.merch")}</Link>
          {displayLinks && (
            <>
              <NavLink onClick={() => handleScroll(musicRef.current)} title={t("nav.music")}>{t("nav.music")}</NavLink>
              <NavLink onClick={() => handleScroll(showsRef.current)} title={t("nav.shows")}>{t("nav.shows")}</NavLink>
              <NavLink onClick={() => handleScroll(contactRef.current)} title={t("nav.contact")}>{t("nav.contact")}</NavLink>
            </>
          )}
          <LangSwitch className="ml-4 pl-4 border-l border-white/10" />
        </div>

        <div className="flex lg:hidden items-center gap-2">
          <LangSwitch className="mr-1" />
          <Link
            to={lp("/merch")}
            aria-label={t("nav.toMerch")}
            className="inline-flex items-center min-h-[44px] px-3 text-xs font-bold uppercase tracking-widest text-amber-400 border border-amber-400/50 hover:bg-amber-400 hover:text-black transition-colors"
          >
            {t("nav.merch")}
          </Link>
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
        <div id="mobile-menu" className="lg:hidden container mx-auto mt-3 pt-1 border-t border-white/10 flex flex-col">
          <Link to={lp("/band")} onClick={closeMenu} className="w-full text-left px-2 py-4 text-sm font-semibold uppercase tracking-widest text-zinc-300 hover:text-amber-400 border-b border-white/5 transition-colors">
            {t("nav.band")}
          </Link>
          <MobileItem onClick={scrollAndClose(musicRef)}>{t("nav.music")}</MobileItem>
          <MobileItem onClick={scrollAndClose(showsRef)}>{t("nav.shows")}</MobileItem>
          <MobileItem onClick={scrollAndClose(contactRef)}>{t("nav.contact")}</MobileItem>
        </div>
      )}
    </nav>
  )
}

export default memo(Navbar);
