import React from "react"
import { Link } from "gatsby"
import Layout from "../components/layout"

const NotFoundPage = () => {
  return (
    <Layout title="404: Not found | Virya">
      <p className="p-4 text-2xl text-white">Division 404</p>
      <p>
        <Link title="Homepage" className="p-4 text-amber-300 cursor-pointer" to="/">Fly back to the main page</Link>
      </p>
    </Layout>
  )
}

export const Head = () => (
  <>
    <title>404: Not found | Virya</title>
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#09090b" />
    <meta name="description" content="Page not found." />
  </>
)

export default NotFoundPage
