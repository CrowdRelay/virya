"use client"
import React from "react"
import { Link, graphql, useStaticQuery } from "gatsby"
import { GatsbyImage, getImage } from "gatsby-plugin-image"
import Navbar from "../components/nav"
import Footer from "../components/footer"
import { ScrollToTop } from "../components/scrollToTop/scroll"
import { useI18n } from "../i18n/I18nContext"
import { getSeoTags } from "../utils/seo"

const SITE = "https://www.virya.music"
const BAND_ID = SITE + "/#band"

const isAlbumLink = link => link && link.includes("/album/")
const isEpRelease = title => /from the ashes/i.test(title)
const trackCount = title => (/echoes of the modern mind/i.test(title) ? 11 : null)

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

const Release = ({ pageContext }) => {
  const { release } = pageContext
  const { t, lp, lang } = useI18n()

  const covers = useStaticQuery(graphql`
    query {
      allFile(
        filter: {
          sourceInstanceName: { eq: "img" }
          extension: { eq: "webp" }
          relativeDirectory: { eq: "" }
        }
      ) {
        nodes {
          relativePath
          childImageSharp {
            gatsbyImageData(
              width: 600
              placeholder: NONE
              formats: [AUTO, WEBP, AVIF]
              quality: 85
            )
          }
        }
      }
    }
  `)

  const node = covers.allFile.nodes.find(n => n.relativePath === release.src)
  const image = node ? getImage(node) : null
  const text = lang === "pl" && release.text_pl ? release.text_pl : release.text
  const album = isAlbumLink(release.link)
  const typeLabel = album
    ? isEpRelease(release.title)
      ? t("release.epType")
      : t("release.albumType")
    : t("release.singleType")
  const tracks = trackCount(release.title)

  return (
    <div className="bg-zinc-950 min-h-screen">
      <header className="header relative lg:overflow-hidden">
        <Navbar displayLinks={true} activePage="music" />
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
                {release.title}
              </h1>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div className="max-w-md">
              {image && (
                <GatsbyImage
                  image={image}
                  alt={release.alt || release.title}
                  className="block w-full rounded-sm"
                  imgClassName="rounded-sm"
                  loading="eager"
                  fetchpriority="high"
                  sizes="(min-width: 1024px) 480px, 100vw"
                />
              )}
            </div>

            <div>
              <p className="uppercase tracking-[0.3em] text-amber-400 text-xs font-bold mb-4">
                {typeLabel}
                {tracks ? ` · ${tracks} ${t("release.tracksLabel")}` : ""}
              </p>
              <p className="lg:text-base text-sm text-zinc-300 leading-relaxed text-justify mb-8">
                {text}
              </p>

              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">
                {t("release.listenHeading")}
              </p>
              <div className="flex flex-wrap gap-2">
                {release.link && <Btn href={release.link}>{t("music.listen")}</Btn>}
                {release.watch && <Btn href={release.watch}>{t("music.watch")}</Btn>}
                {release.buy && <Btn href={release.buy}>{t("music.buy")}</Btn>}
                {release.merch && (
                  <Link
                    to={lp(release.merch)}
                    className="inline-flex items-center min-h-[44px] text-[11px] font-bold uppercase tracking-widest px-4 bg-amber-400 text-black hover:bg-amber-300 transition-all duration-200"
                  >
                    {t("music.merch")}
                  </Link>
                )}
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
  const { release, slug, lang: ctxLang } = pageContext
  const lang = ctxLang || "en"
  const { canonicalUrl, hreflangLinks } = getSeoTags(`/music/${slug}/`, lang)
  const ogLocale = lang === "pl" ? "pl_PL" : "en_US"
  const description = lang === "pl" && release.text_pl ? release.text_pl : release.text
  const title = `${release.title} | Virya`
  const cover = `${SITE}/covers/${release.src}`
  const album = isAlbumLink(release.link)
  const tracks = trackCount(release.title)

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": album ? "MusicAlbum" : "MusicRecording",
    "@id": `${SITE}/#release-${slug}`,
    name: release.title,
    url: release.link,
    image: cover,
    description: release.text,
    genre: ["Metalcore", "Modern Metal"],
    byArtist: { "@id": BAND_ID, "@type": "MusicGroup", name: "Virya" },
    sameAs: [release.link, release.watch, release.buy].filter(Boolean),
    mainEntityOfPage: canonicalUrl,
    ...(album && {
      albumReleaseType: isEpRelease(release.title)
        ? "https://schema.org/EPRelease"
        : "https://schema.org/AlbumRelease",
    }),
    ...(tracks && { numTracks: tracks }),
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
      <meta property="og:type" content="music.album" />
      <meta property="og:site_name" content="Virya" />
      <meta property="og:locale" content={ogLocale} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={cover} />
      <meta property="og:url" content={canonicalUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={cover} />
      <script type="application/ld+json">{schema}</script>
    </>
  )
}

export default Release
