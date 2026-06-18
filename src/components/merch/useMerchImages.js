import { graphql, useStaticQuery } from "gatsby"
import { getImage } from "gatsby-plugin-image"
import { useMemo } from "react"

export const useMerchImages = () => {
  const data = useStaticQuery(graphql`
    query {
      allFile(
        filter: {
          sourceInstanceName: { eq: "img" }
          relativePath: { glob: "merch/*" }
        }
      ) {
        nodes {
          relativePath
          childImageSharp {
            # No width cap: keep the full-res source so the enlarge lightbox
            # stays sharp. quality 80 avoids artifacts when a variant renders
            # near 1:1, and sizes lets the grid pick the ~600w variant on
            # non-retina screens instead of downloading the full 1200w.
            gatsbyImageData(
              placeholder: BLURRED
              formats: [AUTO, WEBP, AVIF]
              quality: 80
              sizes: "(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
            )
          }
        }
      }
    }
  `)

  return useMemo(() => {
    const map = {}
    data.allFile.nodes.forEach(node => {
      map[node.relativePath] = getImage(node)
    })
    return map
  }, [data])
}
