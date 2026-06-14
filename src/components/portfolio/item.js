"use client"
import { GatsbyImage, getImage } from "gatsby-plugin-image"
import { Link } from "gatsby"
import React, { memo, useMemo } from "react"

const Button = memo(({ href, children }) => (
  <a href={href} rel="noreferrer" target="_blank">
    <button className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-amber-400/60 text-amber-400 hover:bg-amber-400 hover:text-black transition-all duration-200">
      {children}
    </button>
  </a>
))

const Overlay = memo(({ title, text, link, watch, buy, merch }) => (
  <div className="z-10 absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent translate-y-1 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out px-4 pt-12 pb-5">
    <h2 className="text-sm lg:text-base font-black uppercase tracking-wide leading-tight mb-1">
      {title}
    </h2>
    <p className="text-xs text-zinc-400 leading-snug mb-3 line-clamp-2">
      {text}
    </p>
    <div className="flex gap-2 flex-wrap">
      {link && <Button href={link}>Listen</Button>}
      {watch && <Button href={watch}>Watch</Button>}
      {buy && <Button href={buy}>Buy</Button>}
      {merch && (
        <Link to={merch}>
          <button className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-amber-400 text-black hover:bg-amber-300 transition-all duration-200">
            Merch
          </button>
        </Link>
      )}
    </div>
  </div>
))

const PortfolioItem = memo(({ item, pictures }) => {
  const matchingPicture = useMemo(
    () => pictures.allFile.nodes.find(node => node.relativePath === item.src),
    [pictures, item]
  )

  return (
    <div className="flex flex-col">
      <div className="relative group block overflow-hidden">
        <div className="hidden lg:block">
          <Overlay {...item} />
        </div>
        {matchingPicture && (
          <GatsbyImage
            image={getImage(matchingPicture)}
            className="block w-full"
            alt={item.alt}
            loading="lazy"
            title={item.title}
            sizes="(min-width: 1024px) 33vw, 100vw"
          />
        )}
      </div>
      <div className="lg:hidden px-3 py-3 bg-zinc-900/60">
        <h2 className="text-sm font-black uppercase tracking-wide leading-tight text-zinc-100 mb-2">
          {item.title}
        </h2>
        <div className="flex gap-2 flex-wrap">
          {item.link && <Button href={item.link}>Listen</Button>}
          {item.watch && <Button href={item.watch}>Watch</Button>}
          {item.buy && <Button href={item.buy}>Buy</Button>}
          {item.merch && (
            <Link to={item.merch}>
              <button className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-amber-400 text-black hover:bg-amber-300 transition-all duration-200">
                Merch
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
})

export default PortfolioItem
