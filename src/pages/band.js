"use client"
import React from "react"
import Navbar from "../components/nav"
import Footer from "../components/footer"
import { Link } from 'gatsby';
import { ScrollToTop } from "../components/scrollToTop/scroll"

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
  <section className='lg:text-base text-sm text-zinc-300 leading-relaxed'>
    {children}
  </section>
);

const Main = () => {
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
        title: "Press Pack",
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
                        <Link title="Homepage" to="/" className="text-zinc-400 hover:text-amber-400 transition-colors text-2xl leading-none">&larr;</Link>
                        <div className="flex items-center gap-4 flex-1">
                            <h1 itemProp="headline" className="text-3xl font-black uppercase tracking-widest whitespace-nowrap text-white">Band Story</h1>
                            <div className="flex-1 h-px bg-zinc-800" />
                        </div>
                    </div>

                    <div className="max-w-3xl space-y-6 mb-16">
                        <BandSection>
                            Virya was founded in 2023 on the initiative of two experienced guitarists Wojciech Bator and Harsha Dasari and drummer Jakub Dąbrowski, who, instead of repeating established patterns, decided to introduce a new approach, combining modern metalcore with non-obvious influences from outside the world of metal. Their combination of strength, technique and emotion brings to mind bands such as Architects, Tesseract or Twelve Foot Ninja, although Virya's music still follows its own, unique path.
                        </BandSection>
                        <BandSection>
                            After some time, Harsha and us parted ways, and the band was joined by Marek Bienias (vocals), whose energy on stage and strong, characteristic voice brought the band's quality to a new level. In 2024, bassist Lubomyr Kosakovsky joined, completing the lineup and adding even more weight to the band's sound.
                        </BandSection>
                        <BandSection>
                            The name Virya not only means positive energy and determination, but is also the band's manifesto — the belief that each concert is not only a musical experience, but a real catharsis that is supposed to release energy and power in the audience. In their music you can hear echoes of struggling with the hardships of everyday life, but also the unwavering will to fight and faith that every person has a chance. No pain, no gain.
                        </BandSection>
                    </div>

                    <div className="mb-16">
                        <div className="flex items-center gap-4 mb-6">
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">Lineup</p>
                            <div className="flex-1 h-px bg-zinc-800/60" />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                            {[
                                { name: 'Wojciech Bator', role: 'Guitar' },
                                { name: 'Marek Bienias', role: 'Vocals' },
                                { name: 'Jakub Dąbrowski', role: 'Drums, Backing Vocals' },
                                { name: 'Lubomyr Kosakovsky', role: 'Bass' },
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
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">Links</p>
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

export const Head = () => (
    <>
        <title>Band Story | Virya - Modern metalcore from Poland</title>
        <link rel="canonical" href="https://www.virya.music/band/" />
        <meta name="description" content="Meet Virya — a modern metalcore band from Poland. Founded in 2023, blending metalcore with influences from Architects, Tesseract and Twelve Foot Ninja." />
        <meta name="keywords" content="Virya, Band Story, Metalcore, Modern Metal, Modern Metalcore, Poland, Heavy, Melodic" />
        <meta name="author" content="Virya" />
        <meta name="theme-color" content="#09090b" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Virya" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:title" content="Band Story | Virya - Modern metalcore from Poland" />
        <meta property="og:description" content="Meet Virya — a modern metalcore band from Poland. Founded in 2023, blending metalcore with influences from Architects, Tesseract and Twelve Foot Ninja." />
        <meta property="og:image" content="https://www.virya.music/virya.webp" />
        <meta property="og:url" content="https://www.virya.music/band/" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@viryaofficial" />
        <meta name="twitter:creator" content="@viryaofficial" />
        <meta name="twitter:title" content="Band Story | Virya - Modern metalcore from Poland" />
        <meta name="twitter:description" content="Meet Virya — a modern metalcore band from Poland. Founded in 2023, blending metalcore with influences from Architects, Tesseract and Twelve Foot Ninja." />
        <meta name="twitter:image" content="https://www.virya.music/virya.webp" />
        <meta name="twitter:url" content="https://www.virya.music/band/" />
    </>
)

export default Main
