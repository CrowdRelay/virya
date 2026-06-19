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
            # Cap at 400 so CONSTRAINED emits an ~800w top variant. Without it
            # the srcSet jumps 600 -> 1200 and the 362px grid display (@2x ~720)
            # is forced to the full 1200x1200, which regressed merch LCP.
            gatsbyImageData(
              width: 400
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
