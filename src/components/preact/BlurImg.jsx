// Preact <img> with build-time blur LQIP background (from src/placeholders.json).
// Mirrors BlurImage.astro for use inside Preact islands. Box shows blur until load.
import ph from "../../placeholders.json"

export default function BlurImg({ src, style, class: cls, className, ...rest }) {
  const blur = ph[src]
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
