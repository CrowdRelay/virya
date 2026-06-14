"use client"
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
                      width: 760
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
        <div className="py-16 lg:px-8 border-t border-zinc-800/60">
            <div className="mx-4 mb-6">
                <div className="flex items-center gap-4 mb-2">
                    <p className="text-3xl font-black uppercase tracking-widest whitespace-nowrap">Portfolio</p>
                    <div className="flex-1 h-px bg-zinc-800" />
                </div>
                <p className="text-zinc-400 text-xs uppercase tracking-widest">Recent releases</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-1 overflow-hidden mx-4">
                {portfolioItems}
            </div>
        </div>
    )
})

export default Portfolio