"use client"
import React from "react"
import Navbar from "../components/nav"
import Footer from "../components/footer"
import { Link } from 'gatsby';
import { ScrollToTop } from "../components/scrollToTop/scroll"

const Main = () => {
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
                    <section className='lg:text-2xl text-s text-justify'>
                    Virya was founded in 2023 on the initiative of two experienced guitarists Wojciech Bator and Harsha Dasari and drummer Jakub Dąbrowski, who, instead of repeating established patterns, decided to introduce a new approach, combining modern metalcore with non-obvious influences from outside the world of metal. Their combination of strength, technique and emotion brings to mind bands such as Architects, Tesseract or Twelve Foot Ninja, although Virya's music still follows its own, unique path.
                    </section>
                    <br></br>
                    <section className='lg:text-2xl text-s text-justify'>
                    After some time, Harsha and us parted ways, and the band was joined by Marek Bienias (vocals), whose energy on stage and strong, characteristic voice brought the band's quality to a new level. In 2024, bassist Lubomyr Kosakovsky joined, completing the lineup and adding even more weight to the band's sound.
                    </section>
                    <br></br>
                    <section className='lg:text-2xl text-s text-justify'>
                    The name Virya not only means positive energy and determination, but is also the band's manifesto - the belief that each concert is not only a musical experience, but a real catharsis that is supposed to release energy and power in the audience. In their music you can hear echoes of struggling with the hardships of everyday life, but also the unwavering will to fight and faith that every person has a chance. No pain, no gain.
                    </section>
                    <br></br>
                    <section className='lg:text-2xl text-s pb-4 text-justify'>
                    Lineup:
                    <br></br>
                    Wojciech Bator (guitar)
                    <br></br>
                    Marek Bienias (vox)
                    <br></br>
                    Jakub Dąbrowski (drums, backing vox)
                    <br></br>
                    Lubomyr Kosakovsky (bass)
                    </section>
                    <br></br>
                    <section className='lg:text-2xl text-s text-justify'>
                    Essential links:
                    </section>
                    <a href="https://www.instagram.com/virya.official" title="Instagram" rel="noreferrer" target="_blank" className="block lg:text-2xl text-amber-300" aria-label="instagram">Instagram</a>
                    <a href="http://youtube.com/@ViryaOfficial?sub_confirmation=1" title="YouTube" rel="noreferrer" target="_blank" className="block lg:text-2xl text-amber-300" aria-label="youtube">YouTube</a>
                    <a href="https://www.facebook.com/ViryaBand" title="Facebook" rel="noreferrer" target="_blank" className="block lg:text-2xl text-amber-300" aria-label="facebook">Facebook</a>
                    <a href="https://open.spotify.com/artist/6bbW0jOKAWJWm3h6CTWaAS" title="Spotify" rel="noreferrer" target="_blank" className="block lg:text-2xl text-amber-300" aria-label="spotify">Spotify</a>
                    <a href="https://virya.bandcamp.com" title="Bandcamp" rel="noreferrer" target="_blank" className="block lg:text-2xl text-amber-300" aria-label="bandcamp">Bandcamp</a>
                    <a href="https://soundcloud.com/viryaofficial" title="SoundCloud" rel="noreferrer" target="_blank" className="block lg:text-2xl text-amber-300" aria-label="soundcloud">Soundcloud</a>
                    <a href="https://x.com/viryaofficial" title="Twitter" rel="noreferrer" target="_blank" className="block lg:text-2xl text-amber-300" aria-label="twitter">Twitter</a>
                    <a href="https://drive.google.com/drive/folders/1T1ZSioSPB0UYNvSk8YFrwC_1xMFbvUVR?usp=drive_link" title="Twitter" rel="noreferrer" target="_blank" className="block lg:text-2xl text-amber-300" aria-label="twitter">Press Pack</a>
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

export default Main
