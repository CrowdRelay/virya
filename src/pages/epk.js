"use client"
import React from "react"
import { Link } from "gatsby"
import Navbar from "../components/nav"
import Footer from "../components/footer"
import { ScrollToTop } from "../components/scrollToTop/scroll"
import { useI18n } from "../i18n/I18nContext"
import { getSeoTags } from "../utils/seo"
import releases from "../components/portfolio/items.json"

const RIDER_URL = "/techrider.pdf"

const slugify = s =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

const LINEUP = [
  { name: "Wojciech Bator", roleKey: "band.roles.guitar" },
  { name: "Marek Bienias", roleKey: "band.roles.vocals" },
  { name: "Jakub Dąbrowski", roleKey: "band.roles.drums" },
  { name: "Lubomyr Kosakovsky", roleKey: "band.roles.bass" },
]

const SOCIALS = [
  { href: "https://www.instagram.com/virya.official", title: "Instagram" },
  { href: "https://www.youtube.com/@ViryaOfficial", title: "YouTube" },
  { href: "https://www.facebook.com/ViryaBand", title: "Facebook" },
  { href: "https://open.spotify.com/artist/6bbW0jOKAWJWm3h6CTWaAS", title: "Spotify" },
  { href: "https://virya.bandcamp.com", title: "Bandcamp" },
  { href: "https://soundcloud.com/viryaofficial", title: "SoundCloud" },
  { href: "https://x.com/viryaofficial", title: "Twitter" },
]

const SectionHeading = ({ children }) => (
  <div className="flex items-center gap-4 mb-6">
    <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">
      {children}
    </p>
    <div className="flex-1 h-px bg-zinc-800/60" />
  </div>
)

const ExtLink = ({ href, children }) => (
  <a
    href={href}
    rel="noreferrer"
    target="_blank"
    className="flex items-center gap-3 py-3 border-b border-zinc-800/50 lg:border-b-0 lg:py-0 lg:flex-1 text-zinc-300 hover:text-amber-400 transition-colors duration-200 group"
  >
    <span aria-hidden="true" className="text-zinc-400 group-hover:text-amber-400 transition-colors text-xs">
      &rarr;
    </span>
    <span className="text-sm font-semibold uppercase tracking-widest">{children}</span>
  </a>
)

const Main = () => {
  const { t, lp } = useI18n()

  return (
    <div className="bg-zinc-950 min-h-screen">
      <header className="header relative lg:overflow-hidden">
        <Navbar displayLinks={true} activePage="epk" />
      </header>
      <ScrollToTop smooth />
      <main id="main-content" className="pt-20 lg:container lg:mx-auto">
        <div className="px-6 lg:px-12 py-12">

          {/* Title row */}
          <div className="flex items-center gap-6 mb-4 border-b border-zinc-800/60 pb-8">
            <Link
              title={t("nav.home")}
              to={lp("/")}
              className="text-zinc-400 hover:text-amber-400 transition-colors text-2xl leading-none"
            >
              &larr;
            </Link>
            <div className="flex items-center gap-4 flex-1">
              <h1 className="text-3xl font-black uppercase tracking-widest whitespace-nowrap text-white">
                {t("epk.heading")}
              </h1>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
          </div>
          <p className="uppercase tracking-[0.3em] text-amber-400 text-xs font-bold mb-12">
            {t("epk.sub")}
          </p>

          {/* Bio */}
          <div className="max-w-3xl space-y-6 mb-16 lg:text-base text-sm text-zinc-300 leading-relaxed text-justify">
            <p>{t("epk.bio1")}</p>
            <p>{t("epk.bio2")}</p>
          </div>

          {/* Quick facts */}
          <div className="grid gap-6 sm:grid-cols-2 mb-16">
            <div className="border-l-2 border-amber-400/30 pl-4 py-2">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-200">
                {t("epk.ffoLabel")}
              </p>
              <p className="text-sm text-zinc-400 mt-1">{t("epk.ffo")}</p>
            </div>
            <div className="border-l-2 border-amber-400/30 pl-4 py-2">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-200">
                {t("epk.styleLabel")}
              </p>
              <p className="text-sm text-zinc-400 mt-1">{t("epk.style")}</p>
            </div>
          </div>

          {/* Lineup */}
          <div className="mb-16">
            <SectionHeading>{t("epk.lineup")}</SectionHeading>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              {LINEUP.map(({ name, roleKey }) => (
                <div key={name} className="border-l-2 border-amber-400/30 pl-4 py-3">
                  <p className="font-bold text-sm text-zinc-100">{name}</p>
                  <p className="text-xs uppercase tracking-widest text-zinc-400 mt-0.5">
                    {t(roleKey)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Technical rider */}
          <div className="mb-16">
            <SectionHeading>{t("epk.riderHeading")}</SectionHeading>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <p className="text-sm text-zinc-400 flex-1">{t("epk.riderText")}</p>
              <a
                href={RIDER_URL}
                target="_blank"
                rel="noreferrer"
                className="self-start text-[11px] font-bold uppercase tracking-widest px-4 py-3 border border-amber-400/60 text-amber-400 hover:bg-amber-400 hover:text-black transition-all duration-200"
              >
                {t("epk.riderDownload")}
              </a>
            </div>
          </div>

          {/* Releases + contact */}
          <div className="grid gap-12 lg:grid-cols-2 mb-16">
            {/* Releases */}
            <div>
              <SectionHeading>{t("epk.releases")}</SectionHeading>
              <div className="max-w-2xl">
                {releases.map(r => (
                  <div
                    key={r.title}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 border-b border-zinc-800/50"
                  >
                    <Link
                      to={lp(`/music/${slugify(r.title)}`)}
                      className="text-sm font-bold uppercase tracking-wide text-zinc-100 hover:text-amber-400 transition-colors flex-1 min-w-[12rem]"
                    >
                      {r.title}
                    </Link>
                    <span className="flex flex-wrap gap-x-4 text-xs uppercase tracking-widest">
                      {r.link && (
                        <a href={r.link} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-amber-400 transition-colors">
                          Spotify
                        </a>
                      )}
                      {r.watch && (
                        <a href={r.watch} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-amber-400 transition-colors">
                          YouTube
                        </a>
                      )}
                      {r.buy && (
                        <a href={r.buy} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-amber-400 transition-colors">
                          Bandcamp
                        </a>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* Contact */}
            <div>
              <SectionHeading>{t("epk.contact")}</SectionHeading>
              <div className="space-y-2">
                <a href="mailto:virya.crew@gmail.com" className="block text-sm font-semibold text-zinc-300 hover:text-amber-400 transition-colors">
                  virya.crew@gmail.com
                </a>
                <a href="tel:+48574090338" className="block text-sm font-semibold text-zinc-300 hover:text-amber-400 transition-colors">
                  +48 574 090 338 (Jakub)
                </a>
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <SectionHeading>{t("epk.links")}</SectionHeading>
            <div className="flex flex-col lg:flex-row lg:flex-wrap lg:gap-x-8 lg:gap-y-3">
              {SOCIALS.map(s => (
                <ExtLink key={s.title} href={s.href}>
                  {s.title}
                </ExtLink>
              ))}
            </div>
          </div>

        </div>
        <Footer />
      </main>
    </div>
  )
}

export const Head = ({ pageContext }) => {
  const lang = pageContext?.lang || "en"
  const { canonicalUrl, hreflangLinks } = getSeoTags("/epk/", lang)
  const ogLocale = lang === "pl" ? "pl_PL" : "en_US"
  const title =
    lang === "pl"
      ? "Dla prasy | Virya"
      : "Press Kit | Virya - Modern metalcore from Poland"
  const description =
    lang === "pl"
      ? "Dla prasy Virya — biografia, skład, rider techniczny, wydawnictwa i kontakt bookingowy."
      : "Virya electronic press kit — biography, lineup, technical rider, releases and booking contact."

  return (
    <>
      <title>{title}</title>
      <link rel="canonical" href={canonicalUrl} />
      {hreflangLinks.map((link, i) => (
        <link key={i} rel={link.rel} hrefLang={link.hreflang} href={link.href} />
      ))}
      <meta name="description" content={description} />
      <meta name="keywords" content="Virya, EPK, Press Kit, Technical Rider, Booking, Metalcore, Modern Metal, Poland" />
      <meta name="author" content="Virya" />
      <meta name="theme-color" content="#09090b" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Virya" />
      <meta property="og:locale" content={ogLocale} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content="https://www.virya.music/virya.webp" />
      <meta property="og:url" content={canonicalUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@viryaofficial" />
      <meta name="twitter:creator" content="@viryaofficial" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content="https://www.virya.music/virya.webp" />
      <meta name="twitter:url" content={canonicalUrl} />
    </>
  )
}

export default Main
