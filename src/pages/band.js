"use client"
import React from "react"
import Navbar from "../components/nav"
import Footer from "../components/footer"
import { Link } from 'gatsby';
import { StaticImage } from "gatsby-plugin-image"
import { ScrollToTop } from "../components/scrollToTop/scroll"
import { useI18n } from "../i18n/I18nContext"
import { getSeoTags } from "../utils/seo"

const SocialLink = ({ href, title, ariaLabel }) => (
  <a
    href={href}
    title={title}
    rel="noreferrer"
    target="_blank"
    className="flex items-center gap-3 py-3 border-b border-zinc-800/50 text-zinc-300 hover:text-amber-400 transition-colors duration-200 group"
  >
    <span aria-hidden="true" className="text-zinc-400 group-hover:text-amber-400 transition-colors text-xs">&rarr;</span>
    <span className="text-sm font-semibold uppercase tracking-widest">{title}</span>
  </a>
);

const BandSection = ({ children }) => (
  <section className='lg:text-base text-sm text-zinc-300 leading-relaxed text-justify'>
    {children}
  </section>
);

const Main = () => {
    const { t, lp } = useI18n()
    const socialLinks = [
      {
        href: "https://www.instagram.com/virya.official",
        title: "Instagram",
        ariaLabel: "instagram"
      },
      {
        href: "http://youtube.com/@ViryaOfficial?sub_confirmation=1", 
        title: "YouTube",
        ariaLabel: "youtube"
      },
      {
        href: "https://www.facebook.com/ViryaBand",
        title: "Facebook", 
        ariaLabel: "facebook"
      },
      {
        href: "https://open.spotify.com/artist/6bbW0jOKAWJWm3h6CTWaAS",
        title: "Spotify",
        ariaLabel: "spotify"
      },
      {
        href: "https://virya.bandcamp.com",
        title: "Bandcamp",
        ariaLabel: "bandcamp"
      },
      {
        href: "https://soundcloud.com/viryaofficial",
        title: "SoundCloud",
        ariaLabel: "soundcloud"
      },
      {
        href: "https://x.com/viryaofficial",
        title: "Twitter",
        ariaLabel: "twitter"
      },
      {
        href: "https://drive.google.com/drive/folders/1M4pgB9goigGUm9tudcQIzORTgILgSABH?usp=drive_link",
        title: t("band.pressPack"),
        ariaLabel: "press-pack"
      }
    ];

    return (
        <div className="bg-zinc-950 min-h-screen">
            <header className="header relative lg:overflow-hidden">
                <Navbar displayLinks={false} />
            </header>
            <ScrollToTop smooth />
            <div className="pt-20 lg:container lg:mx-auto">
                <div className="px-6 lg:px-12 py-12">

                    <div className="flex items-center gap-6 mb-12 border-b border-zinc-800/60 pb-8">
                        <Link title={t("nav.home")} to={lp("/")} className="text-zinc-400 hover:text-amber-400 transition-colors text-2xl leading-none">&larr;</Link>
                        <div className="flex items-center gap-4 flex-1">
                            <h1 itemProp="headline" className="text-3xl font-black uppercase tracking-widest whitespace-nowrap text-white">{t("band.storyHeading")}</h1>
                            <div className="flex-1 h-px bg-zinc-800" />
                        </div>
                        <Link
                            to={lp("/merch")}
                            title={t("nav.toMerch")}
                            className="inline-flex items-center px-3 min-h-[44px] text-xs font-bold uppercase tracking-widest text-amber-400 border border-amber-400/50 hover:bg-amber-400 hover:text-black transition-colors whitespace-nowrap"
                        >
                            {t("nav.merch")}
                        </Link>
                    </div>

                    <div className="max-w-3xl mb-10">
                        <StaticImage
                            src="../images/band.webp"
                            alt="Virya band photo"
                            className="w-full block mx-auto mb-10 rounded-sm"
                            imgClassName="rounded-sm"
                            placeholder="blurred"
                            loading="lazy"
                            width={768}
                            sizes="(min-width: 768px) 768px, 100vw"
                        />
                    </div>

                    <div className="max-w-3xl space-y-6 mb-16">
                        <BandSection>{t("band.story1")}</BandSection>
                        <BandSection>{t("band.story2")}</BandSection>
                        <BandSection>{t("band.story3")}</BandSection>
                    </div>

                    <div className="mb-16">
                        <div className="flex items-center gap-4 mb-6">
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">{t("band.lineup")}</p>
                            <div className="flex-1 h-px bg-zinc-800/60" />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                            {[
                                { name: 'Wojciech Bator', role: t("band.roles.guitar") },
                                { name: 'Marek Bienias', role: t("band.roles.vocals") },
                                { name: 'Jakub Dąbrowski', role: t("band.roles.drums") },
                                { name: 'Lubomyr Kosakovsky', role: t("band.roles.bass") },
                            ].map(({ name, role }) => (
                                <div key={name} className="border-l-2 border-amber-400/30 pl-4 py-3">
                                    <p className="font-bold text-sm text-zinc-100">{name}</p>
                                    <p className="text-xs uppercase tracking-widest text-zinc-400 mt-0.5">{role}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">{t("band.links")}</p>
                            <div className="flex-1 h-px bg-zinc-800/60" />
                        </div>
                        <div className="max-w-sm">
                            {socialLinks.map((link, index) => (
                                <SocialLink
                                    key={index}
                                    href={link.href}
                                    title={link.title}
                                    ariaLabel={link.ariaLabel}
                                />
                            ))}
                        </div>
                    </div>

                </div>
                <Footer />
            </div>
        </div>
    )
}

export const Head = ({ pageContext }) => {
    const lang = pageContext?.lang || "en"
    const { canonicalUrl, hreflangLinks } = getSeoTags("/band/", lang)
    const ogLocale = lang === "pl" ? "pl_PL" : "en_US"
    const title = lang === "pl" ? "Historia zespołu | Virya - Nowoczesny metalcore z Polski" : "Band Story | Virya - Modern metalcore from Poland"
    const description = lang === "pl" 
        ? "Poznaj Virya — nowoczesny zespół metalcore z Polski. Założona w 2023, łączy metalcore z inspiracjami od Architects, Tesseract i Twelve Foot Ninja."
        : "Meet Virya — a modern metalcore band from Poland. Founded in 2023, blending metalcore with influences from Architects, Tesseract and Twelve Foot Ninja."

    return (
        <>
            <title>{title}</title>
            <link rel="canonical" href={canonicalUrl} />
            {hreflangLinks.map((link, i) => (
                <link key={i} rel={link.rel} hreflang={link.hreflang} href={link.href} />
            ))}
            <meta name="description" content={description} />
            <meta name="keywords" content="Virya, Band Story, Metalcore, Modern Metal, Modern Metalcore, Poland, Heavy, Melodic" />
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
