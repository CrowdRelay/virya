import { GatsbyImage, getImage } from 'gatsby-plugin-image'
import React, { useMemo } from 'react'

const PortfolioItem = ({ item, pictures }) => {
    const matchingPicture = useMemo(() => (
        pictures.allFile.nodes.find(node => node.relativePath === item.src)
    ), [pictures, item])
    return <div className="relative group block">
        <div className="z-10 transform ease-in-out rounded-xl absolute inset-0 bg-black opacity-0 group-hover:opacity-75 place-items-center justify-center flex flex-col flex-grow-1 px-4 py-4 cursor-pointer">
            <h2 className="text-lg lg:text-2xl mb-2">{item.title}</h2>
            <p className="text-center leading-normal">{item.text}</p>
            <div>
                <a title="Listen" href={item.link} rel="noreferrer" target="_blank"><button className="lg:px-6 py-2 mx-2 my-8 btn-outline-primary transition duration-500 ease-in-out focus:outline-none focus:shadow-outline border border-amber-300 hover:bg-amber-200 text-amber-300 hover:text-black font-normal px-4 rounded">Listen</button></a>
                {item.buy && <a title="Buy" href={item.buy} rel="noreferrer" target="_blank"><button className="lg:px-6 mx-2 py-2 my-8 btn-outline-primary transition duration-500 ease-in-out focus:outline-none focus:shadow-outline border border-amber-300 hover:bg-amber-200 text-amber-300 hover:text-black font-normal px-4 rounded">Buy</button></a>}
            </div>
        </div>
        {matchingPicture && <GatsbyImage image={getImage(matchingPicture)} className="rounded-xl" src={item.src} alt={item.alt} loading='lazy' title={item.title} />}
    </div>
}

export default PortfolioItem