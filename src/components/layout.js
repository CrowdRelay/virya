"use client"
import React from "react"
import Footer from "./footer"

const Layout = ({children}) =>
    <div className="lg:container lg:mx-auto bg-stone-900">
        <main>{children}</main>
        <Footer/>
    </div>

export default Layout
