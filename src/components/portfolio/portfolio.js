import React, { memo, useMemo } from 'react'
import { graphql, useStaticQuery } from 'gatsby'
import PortfolioItem from './item'
import items from './items.json'

const Portfolio = memo(() => {
    const pictures = useStaticQuery(graphql`
    query {
        allFile(filter: { sourceInstanceName: { eq: "img" } }) {
            nodes {
                relativePath
                childImageSharp {
                    gatsbyImageData(
                      placeholder: BLURRED
                      formats: [AUTO, WEBP, AVIF]
                    )
                  }
            }
        }
    }
  `)

    const portfolioItems = useMemo(() => (
        items.map(item => (
            <PortfolioItem 
                key={item.link} 
                item={item} 
                pictures={pictures}
            />
        ))
    ), [pictures])

    return (
        <div className="bg-stone-900 py-8 lg:px-8 lg:rounded-b-2xl">
            <div className="text-center mb-8 mx-4">
                <p className="text-4xl font-bold leading-tight my-4">Portfolio</p>
                <p className="italic w-full my-4">Check out our recent releases</p>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden relative my-8">
                    {portfolioItems}
                </div>
            </div>
        </div>
    )
})

export default Portfolio