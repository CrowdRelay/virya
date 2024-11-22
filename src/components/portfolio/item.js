import { GatsbyImage, getImage } from 'gatsby-plugin-image'
import React, { memo, useMemo } from 'react'

const Button = memo(({ title, href, children }) => (
  <a title={title} href={href} rel="noreferrer" target="_blank">
    <button className="lg:px-6 mx-2 py-2 my-8 btn-outline-primary transition duration-500 ease-in-out focus:outline-none focus:shadow-outline border border-amber-300 hover:bg-amber-200 text-amber-300 hover:text-black font-normal px-4 rounded">
      {children}
    </button>
  </a>
))

const Overlay = memo(({ title, text, link, watch, buy }) => (
  <div className="z-10 transform ease-in-out rounded-xl absolute inset-0 bg-black opacity-0 group-hover:opacity-75 place-items-center justify-center flex flex-col flex-grow-1 px-4 py-4 cursor-pointer">
    <h2 className="text-lg lg:text-2xl mb-2">{title}</h2>
    <p className="text-center leading-normal">{text}</p>
    <div>
      <Button title="Listen" href={link}>Listen</Button>
      {watch && <Button title="Watch" href={watch}>Watch</Button>}
      {buy && <Button title="Buy" href={buy}>Buy</Button>}
    </div>
  </div>
))

const PortfolioItem = memo(({ item, pictures }) => {
  const matchingPicture = useMemo(() => (
    pictures.allFile.nodes.find(node => node.relativePath === item.src)
  ), [pictures, item])

  return (
    <div className="relative group block">
      <Overlay {...item} />
      {matchingPicture && (
        <GatsbyImage 
          image={getImage(matchingPicture)} 
          className="rounded-xl" 
          alt={item.alt}
          loading='lazy'
          title={item.title}
        />
      )}
    </div>
  )
})

export default PortfolioItem