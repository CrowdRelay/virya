"use client"
import React, { memo } from "react"
import Footer from "./footer"

const Layout = memo(({ children }) => (
  <div className="lg:container lg:mx-auto bg-stone-900 min-h-screen flex flex-col">
    <main className="flex-grow">{children}</main>
    <Footer />
  </div>
))

export default Layout
