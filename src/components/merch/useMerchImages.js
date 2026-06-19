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
            # 360px display with explicit 1x/2x/3x rungs -> 360/720/1080. Each
            # device pulls only what its DPR needs: 2x screens get the light
            # 720w (fast LCP), 3x phones get the sharp 1080w. Avoids the old
            # 800w cap that upscaled (blurry) on 3x yet was too heavy at 2x.
            gatsbyImageData(
              width: 360
              placeholder: NONE
              formats: [AUTO, WEBP, AVIF]
              quality: 65
              outputPixelDensities: [1, 2, 3]
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
