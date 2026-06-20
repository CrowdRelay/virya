"use client"
import React from "react"
import { Link } from "gatsby"
import { GatsbyImage } from "gatsby-plugin-image"
import Navbar from "../components/nav"
import Footer from "../components/footer"
import { ScrollToTop } from "../components/scrollToTop/scroll"
import { useI18n } from "../i18n/I18nContext"
import { getSeoTags } from "../utils/seo"

const SITE = "https://www.virya.music"

const Btn = ({ href, children }) => (
  <a
    href={href}
    rel="noreferrer"
    target="_blank"
    className="inline-flex items-center min-h-[44px] text-[11px] font-bold uppercase tracking-widest px-4 border border-amber-400/60 text-amber-400 hover:bg-amber-400 hover:text-black transition-all duration-200"
  >
    {children}
  </a>
)

const Gig = ({ pageContext }) => {
  const { gig } = pageContext
  const { t, lp, lang } = useI18n()

  const formattedDate = new Date(gig.date).toLocaleDateString(
    lang === "pl" ? "pl-PL" : "en-GB",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  )

  return (
    <div className="bg-zinc-950 min-h-screen">
      <header className="header relative lg:overflow-hidden">
        <Navbar displayLinks={true} activePage="shows" />
      </header>
      <ScrollToTop smooth />
      <main id="main-content" className="pt-20 lg:container lg:mx-auto">
        <div className="px-6 lg:px-12 py-12">
          <div className="flex items-center gap-6 mb-10 border-b border-zinc-800/60 pb-8">
            <Link
              title={t("nav.home")}
              to={lp("/")}
              className="text-zinc-400 hover:text-amber-400 transition-colors text-2xl leading-none"
            >
              &#8656;
            </Link>
            <div className="flex items-center gap-4 flex-1">
              <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-widest text-white">
                {gig.venueName}
              </h1>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div className="max-w-md">
              {gig.image ? (
                <GatsbyImage
                  image={gig.image}
                  alt={gig.venueName || gig.title}
                  className="block w-full rounded-sm"
                  imgClassName="rounded-sm"
                  loading="eager"
                  fetchpriority="high"
                  sizes="(min-width: 1024px) 364px, 100vw"
                />
              ) : (
                <div className="block w-full rounded-sm bg-zinc-900 aspect-square flex items-center justify-center">
                  <span className="text-zinc-600 text-sm">{t("gig.noImage")}</span>
                </div>
              )}
            </div>

            <div>
              <p className="uppercase tracking-[0.3em] text-amber-400 text-xs font-bold mb-4">
                {formattedDate}
              </p>
              {gig.city && (
                <p className="text-sm text-zinc-400 uppercase tracking-widest mb-4">
                  {gig.city}
                </p>
              )}

              {gig.description && (
                <p className="lg:text-base text-sm text-zinc-300 leading-relaxed text-justify whitespace-pre-line mb-8">
                  {gig.description}
                </p>
              )}

              {gig.lineup && gig.lineup.length > 0 && (
                <>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">
                    {t("gig.lineup")}
                  </p>
                  <p className="text-sm text-zinc-300 mb-8">
                    {gig.lineup.join(", ")}
                  </p>
                </>
              )}

              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">
                {t("gig.getTickets")}
              </p>
              <div className="flex flex-wrap gap-2">
                {gig.event && <Btn href={gig.event}>{t("shows.event")}</Btn>}
                {gig.tickets && <Btn href={gig.tickets}>{t("shows.tickets")}</Btn>}
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    </div>
  )
}

export const Head = ({ pageContext }) => {
  const { gig, slug, lang: ctxLang } = pageContext
  const lang = ctxLang || "en"
  const { canonicalUrl, hreflangLinks } = getSeoTags(`/shows/${slug}/`, lang)
  const ogLocale = lang === "pl" ? "pl_PL" : "en_US"
  const description = gig.description || `${gig.venueName} - ${gig.city}`
  const title = `${gig.venueName} | Virya`
  const image = gig.imageUrl || `${SITE}/og-image.webp`

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    "@id": `${SITE}/#gig-${slug}`,
    name: gig.title,
    url: gig.event,
    image: image,
    description: description,
    startDate: gig.date,
    endDate: gig.date,
    eventStatus: "https://schema.org/EventScheduled",
    performer: {
      "@type": "MusicGroup",
      name: "Virya",
      url: SITE,
    },
    location: {
      "@type": "Place",
      name: gig.venueName,
      address: gig.city,
    },
    ...(gig.tickets && {
      offers: {
        "@type": "Offer",
        url: gig.tickets,
        availability: "https://schema.org/InStock",
      },
    }),
    mainEntityOfPage: canonicalUrl,
  })

  return (
    <>
      <title>{title}</title>
      <link rel="canonical" href={canonicalUrl} />
      {hreflangLinks.map((link, i) => (
        <link key={i} rel={link.rel} hrefLang={link.hreflang} href={link.href} />
      ))}
      <meta name="description" content={description} />
      <meta name="author" content="Virya" />
      <meta name="theme-color" content="#09090b" />
      <meta property="og:type" content="music.event" />
      <meta property="og:site_name" content="Virya" />
      <meta property="og:locale" content={ogLocale} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={canonicalUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <script type="application/ld+json">{schema}</script>
    </>
  )
}

export default Gig
