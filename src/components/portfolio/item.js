"use client"
import { GatsbyImage, getImage } from "gatsby-plugin-image"
import { Link } from "gatsby"
import React, { memo, useMemo } from "react"
import { useI18n } from "../../i18n/I18nContext"

const Button = memo(({ href, children }) => (
  <a
    href={href}
    rel="noreferrer"
    target="_blank"
    className="inline-flex items-center min-h-[44px] text-[10px] font-bold uppercase tracking-widest px-3 border border-amber-400/60 text-amber-400 hover:bg-amber-400 hover:text-black transition-all duration-200"
  >
    {children}
  </a>
))

const slugify = s =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

const Overlay = memo(({ title, text, link, watch, buy, merch }) => {
  const { t, lp } = useI18n()
  return (
    <div className="z-10 absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent translate-y-1 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 max-lg:opacity-100 max-lg:translate-y-0 transition-all duration-300 ease-out px-4 pt-12 pb-5">
      <h2 className="text-sm lg:text-base font-black uppercase tracking-wide leading-tight mb-1">
        <Link to={lp(`/music/${slugify(title)}`)} className="hover:text-amber-400 transition-colors">
          {title}
        </Link>
      </h2>
      <p className="text-xs text-justify text-zinc-400 leading-snug mb-3 line-clamp-4">
        {text}
      </p>
      <div className="flex gap-2 flex-wrap">
        {link && <Button href={link}>{t("music.listen")}</Button>}
        {watch && <Button href={watch}>{t("music.watch")}</Button>}
        {buy && <Button href={buy}>{t("music.buy")}</Button>}
        {merch && (
          <Link
            to={lp(merch)}
            aria-label={t("music.browseMerch")}
            className="inline-flex items-center min-h-[44px] text-[10px] font-bold uppercase tracking-widest px-3 bg-amber-400 text-black hover:bg-amber-300 transition-all duration-200"
          >
            {t("music.merch")}
          </Link>
        )}
      </div>
    </div>
  )
})

const PortfolioItem = memo(({ item, pictures }) => {
  const { lang, lp } = useI18n()
  const matchingPicture = useMemo(
    () => pictures.allFile.nodes.find(node => node.relativePath === item.src),
    [pictures, item]
  )
  const text = lang === "pl" && item.text_pl ? item.text_pl : item.text

  return (
    <div className="relative group block overflow-hidden">
      <Overlay {...item} text={text} />
      {matchingPicture && (
        <Link
          to={lp(`/music/${slugify(item.title)}`)}
          aria-label={item.title}
          className="block"
        >
          <GatsbyImage
            image={getImage(matchingPicture)}
            className="block w-full"
            alt={item.alt}
            loading="lazy"
            title={item.title}
            sizes="(min-width: 1024px) 33vw, 100vw"
          />
        </Link>
      )}
    </div>
  )
})

export default PortfolioItem
