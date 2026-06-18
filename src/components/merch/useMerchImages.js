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
            gatsbyImageData(
              width: 400
              placeholder: BLURRED
              formats: [AUTO, WEBP, AVIF]
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
