// Preact <img> with build-time blur LQIP + responsive srcset.
// Mirrors BlurImage.astro for use inside Preact islands.
import ph from "../../placeholders.json"
import ss from "../../srcsets.json"

export default function BlurImg({
  src,
  style,
  class: cls,
  className,
  sizes = "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 1200px",
  ...rest
}) {
  const blur = ph[src]
  const srcset = ss[src]
  const bg = blur
    ? {
        backgroundImage: `url(${blur})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        color: "transparent",
      }
    : {}
  return (
    <img
      src={src}
      srcSet={srcset}
      sizes={srcset ? sizes : undefined}
      class={cls || className}
      style={{ ...bg, ...(style || {}) }}
      onLoad={(e) => {
        e.currentTarget.style.backgroundImage = "none"
        e.currentTarget.style.color = ""
      }}
      onError={(e) => {
        e.currentTarget.style.color = ""
      }}
      {...rest}
    />
  )
}
