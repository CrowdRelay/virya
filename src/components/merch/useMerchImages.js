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
            # Cards: 2-col mobile (~48vw) / 3-col desktop (~33vw). Rungs
            # 400/600/800/1200 let each DPR pull only what it needs: a 3x
            # phone on the small mobile card grabs ~600w (light -> fast LCP)
            # yet renders ~3.4x = razor sharp; desktop 2x gets 800w. BLURRED
            # gives an instant blur-up while the sharp image streams in.
            gatsbyImageData(
              width: 400
              placeholder: BLURRED
              formats: [AUTO, WEBP, AVIF]
              quality: 100
              outputPixelDensities: [1, 1.5, 2, 3]
              sizes: "(min-width: 1024px) 33vw, 48vw"
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
