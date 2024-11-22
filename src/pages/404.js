"use client"
import React, { memo } from "react"
import { Link } from "gatsby"
import Layout from "../components/layout"

const NotFoundPage = () => memo(
  <Layout title="404: Not found | Virya">
    <p className="p-4 text-2xl">Division 404</p>
    <p>
      <Link title="Homepage" className="p-4 text-amber-300 cursor-pointer" to="/">Fly back to the main page</Link>
    </p>
  </Layout>
)

export const Head = ({ location }) => (
  <>
    <title>404: Not found | Virya</title>
    <link rel="canonical" href="https://www.virya.music" />
    <meta name="description" content="A website of Virya, a new modern metalcore powerhorse from Poland. Check out the latest releases and news." />
    <meta name="og:title" content="404: Not found | Virya" />
    <meta name="og:image" content='https://www.virya.music/virya.webp' />
    <meta name="og:url" content={`https://www.virya.music/${location.pathname}`} />
    <meta name="og:type" content='website' />
    <meta name="og:description" content="A website of Virya, a new modern metalcore powerhorse from Poland. Check out the latest releases and news." />
    <meta name="keywords" content='Virya, Music, Band, Metalcore, Modern Metal, Modern Metalcore, Heavy, Melodic, Virtuoso, Alternative' />
    <meta name="facebook:card" content="summary" />
    <meta name="facebook:creator" content="ViryaBand" />
    <meta name="facebook:title" content="404: Not found | Virya" />
    <meta name="facebook:description" content="A website of Virya, a new modern metalcore powerhorse from Poland. Check out the latest releases and news." />
    <meta name="facebook:image" content="https://www.virya.music/virya.webp" />
    <meta name="facebook:url" content={`https://www.virya.music/${location.pathname}`} />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="404: Not found | Virya" />
    <meta name="twitter:url" content={`https://www.virya.music/${location.pathname}`} />
    <meta name="twitter:description" content="A website of Virya, a new modern metalcore powerhorse from Poland. Check out the latest releases and news." />
    <meta name="twitter:image" content="https://www.virya.music/virya.webp" />
    <meta name="twitter:creator" content="viryaofficial" />
  </>
)

export default NotFoundPage
