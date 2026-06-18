import React from "react"
import Footer from "./footer"

const Layout = ({ children }) => (
  <div className="lg:container lg:mx-auto bg-zinc-950 min-h-screen flex flex-col">
    <main id="main-content" className="flex-grow">{children}</main>
    <Footer />
  </div>
)

export default Layout
