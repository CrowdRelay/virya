import { useState, useEffect, useRef, useCallback, memo } from "preact/hooks"
import { LanguageProvider, useI18n } from "../../i18n/I18nContext"
import LangSwitch from "./LangSwitch"
import BlurImg from "./BlurImg"

const NavLink = memo(({ href, children, isActive }) => (
  <a
    href={href}
    class={`text-xs font-bold uppercase tracking-widest transition-colors duration-200 ${
      isActive
        ? "text-amber-400"
        : "text-zinc-100 hover:text-amber-400"
    }`}
  >
    {children}
  </a>
))

const NavbarInner = ({ displayLinks, activePage, activeSection }) => {
  const { t, lp } = useI18n()
  const [headerVisible, setHeaderVisible] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const lastScrollY = useRef(0)

  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY
        if (currentScrollY < 10) {
          setHeaderVisible(true)
          lastScrollY.current = currentScrollY
          ticking = false
          return
        }
        if (currentScrollY > lastScrollY.current) {
          setHeaderVisible(false)
          setMenuOpen(false)
        } else {
          setHeaderVisible(true)
        }
        lastScrollY.current = currentScrollY
        ticking = false
      })
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (!displayLinks) return
    const sectionIds = ["music", "shows", "contact"]
    const visible = new Set()
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) visible.add(e.target.id)
          else visible.delete(e.target.id)
        })
      },
      { rootMargin: "-150px 0px -55% 0px", threshold: 0 }
    )
    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [displayLinks])

  const isActive = (section) => {
    if (section === "home" && activePage === "home") return !activeSection
    return activePage === section || activeSection === section
  }

  return (
    <nav
      class={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        headerVisible ? "translate-y-0" : "-translate-y-full"
      }`}
      aria-label="Main navigation"
    >
      <div class="bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800/60">
        <div class="flex items-center justify-between px-4 lg:px-8 h-16">
          <a href={lp("/")} class="flex items-center gap-3" aria-label="Virya home">
            <BlurImg
              src="/virya.webp"
              alt="Virya"
              width="32"
              height="32"
              class="w-8 h-8"
              loading="eager"
            />
            <span class="text-xs font-black uppercase tracking-[0.25em] text-zinc-100">
              Virya
            </span>
          </a>

          {displayLinks && (
            <div class="hidden lg:flex items-center gap-8">
              <NavLink href={lp("/#about")} isActive={isActive("about")}>
                {t("nav.band")}
              </NavLink>
              <NavLink href={lp("/#music")} isActive={isActive("music")}>
                {t("nav.music")}
              </NavLink>
              <NavLink href={lp("/#shows")} isActive={isActive("shows")}>
                {t("nav.shows")}
              </NavLink>
              <NavLink href={lp("/#contact")} isActive={isActive("contact")}>
                {t("nav.contact")}
              </NavLink>
              <a
                href={lp("/merch")}
                class={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 border transition-colors duration-200 ${
                  activePage === "merch"
                    ? "border-amber-400 bg-amber-400 text-black"
                    : "border-amber-400/60 text-amber-400 hover:bg-amber-400 hover:text-black"
                }`}
              >
                {t("nav.merch")}
              </a>
            </div>
          )}

          <div class="flex items-center gap-4">
            <LangSwitch />
            {displayLinks && (
              <button
                class="lg:hidden p-2 text-zinc-300 hover:text-amber-400 transition-colors"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
                aria-expanded={menuOpen}
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  {menuOpen ? (
                    <>
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </>
                  ) : (
                    <>
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </>
                  )}
                </svg>
              </button>
            )}
          </div>
        </div>

        {displayLinks && menuOpen && (
          <div class="lg:hidden border-t border-zinc-800/60 px-4 py-4 flex flex-col gap-4">
            <a href={lp("/#about")} class="text-xs font-bold uppercase tracking-widest text-zinc-100 hover:text-amber-400 transition-colors py-2" onClick={() => setMenuOpen(false)}>
              {t("nav.band")}
            </a>
            <a href={lp("/#music")} class="text-xs font-bold uppercase tracking-widest text-zinc-100 hover:text-amber-400 transition-colors py-2" onClick={() => setMenuOpen(false)}>
              {t("nav.music")}
            </a>
            <a href={lp("/#shows")} class="text-xs font-bold uppercase tracking-widest text-zinc-100 hover:text-amber-400 transition-colors py-2" onClick={() => setMenuOpen(false)}>
              {t("nav.shows")}
            </a>
            <a href={lp("/#contact")} class="text-xs font-bold uppercase tracking-widest text-zinc-100 hover:text-amber-400 transition-colors py-2" onClick={() => setMenuOpen(false)}>
              {t("nav.contact")}
            </a>
            <a href={lp("/merch")} class="text-xs font-bold uppercase tracking-widest px-3 py-2 border border-amber-400/60 text-amber-400 text-center" onClick={() => setMenuOpen(false)}>
              {t("nav.merch")}
            </a>
          </div>
        )}
      </div>
    </nav>
  )
}

const Navbar = ({ lang, ...props }) => (
  <LanguageProvider initialLang={lang}>
    <NavbarInner {...props} />
  </LanguageProvider>
)

export default Navbar
