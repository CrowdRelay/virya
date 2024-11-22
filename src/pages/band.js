"use client"
import React, { memo } from "react"
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
    className="block lg:text-2xl text-amber-300"
    aria-label={ariaLabel}
  >
    {title}
  </a>
);

const BandSection = ({ children }) => (
  <section className='lg:text-2xl text-s text-justify'>
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
        <div>
            <header className="header relative lg:overflow-hidden">
                <Navbar displayLinks={false} />
            </header>
            <ScrollToTop smooth/>
                <div className="p-4 pt-20 lg:container lg:mx-auto bg-stone-900">
                    <header className="grid grid-cols-3 py-12 items-center">
                        <Link title="Homepage" className="justify-self-start lg:text-4xl text-xl" to="/">&lArr;</Link>
                        <h1 itemProp="headline" className="justify-self-center lg:text-4xl text-xl lg:my-2">BAND STORY</h1>
                        <p className="justify-self-end"></p>
                    </header>
                    
                    <BandSection>
                      Virya was founded in 2023 on the initiative of two experienced guitarists Wojciech Bator and Harsha Dasari and drummer Jakub Dąbrowski, who, instead of repeating established patterns, decided to introduce a new approach, combining modern metalcore with non-obvious influences from outside the world of metal. Their combination of strength, technique and emotion brings to mind bands such as Architects, Tesseract or Twelve Foot Ninja, although Virya's music still follows its own, unique path.
                    </BandSection>
                    <br />
                    
                    <BandSection>
                      After some time, Harsha and us parted ways, and the band was joined by Marek Bienias (vocals), whose energy on stage and strong, characteristic voice brought the band's quality to a new level. In 2024, bassist Lubomyr Kosakovsky joined, completing the lineup and adding even more weight to the band's sound.
                    </BandSection>
                    <br />
                    
                    <BandSection>
                      The name Virya not only means positive energy and determination, but is also the band's manifesto - the belief that each concert is not only a musical experience, but a real catharsis that is supposed to release energy and power in the audience. In their music you can hear echoes of struggling with the hardships of everyday life, but also the unwavering will to fight and faith that every person has a chance. No pain, no gain.
                    </BandSection>
                    <br />
                    
                    <BandSection>
                      Lineup:
                      <br />
                      Wojciech Bator (guitar)
                      <br />
                      Marek Bienias (vox)
                      <br />
                      Jakub Dąbrowski (drums, backing vox)
                      <br />
                      Lubomyr Kosakovsky (bass)
                    </BandSection>
                    <br />
                    
                    <BandSection>
                      Essential links:
                    </BandSection>

                    {socialLinks.map((link, index) => (
                      <SocialLink 
                        key={index}
                        href={link.href}
                        title={link.title}
                        ariaLabel={link.ariaLabel}
                      />
                    ))}
                    
                    <Footer />
                </div>
        </div>
    )
}

export const Head = () => {
    return (
        <>
            <title>Band | Virya - Modern metalcore from Poland</title>
            <link rel="canonical" href="https://www.virya.music" />
            <meta name="description"
                content="A website of Virya, a new modern metalcore powerhorse from Poland. Check out the latest releases and news." />
            <meta name="og:title" content='Virya | Modern metalcore from Poland' />
            <meta name="og:image" content='https://www.virya.music/virya.webp' />
            <meta name="og:url" content="https://www.virya.music" />
            <meta name="og:type" content='website' />
            <meta name="og:description"
                content="A website of Virya, a new modern metalcore powerhorse from Poland. Check out the latest releases and news." />
            <meta name="keywords"
                content='Virya, Music, Band, Metalcore, Modern Metal, Modern Metalcore, Heavy, Melodic, Virtuoso, Alternative' />
            <meta name="facebook:card" content="summary" />
            <meta name="facebook:creator" content="ViryaBand" />
            <meta name="facebook:title" content='Virya | Modern metalcore from Poland' />
            <meta name="facebook:description"
                content="A website of Virya, a new modern metalcore powerhorse from Poland. Check out the latest releases and news." />
            <meta name="facebook:image" content="https://www.virya.music/virya.webp" />
            <meta name="facebook:url" content="https://www.virya.music" />
            <meta name="twitter:card" content="summary" />
            <meta name="twitter:title" content='Virya | Modern metalcore from Poland' />
            <meta name="twitter:url" content="https://www.virya.music" />
            <meta name="twitter:description"
                content="A website of Virya, a new modern metalcore powerhorse from Poland. Check out the latest releases and news." />
            <meta name="twitter:image" content="https://www.virya.music/virya.webp" />
            <meta name="twitter:creator" content="viryaofficial" />
        </>
    )
}

export default memo(Main)
