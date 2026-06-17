"use client"
import React from "react"
import { Link } from "gatsby"
import Navbar from "./nav"
import Footer from "./footer"
import { ScrollToTop } from "./scrollToTop/scroll"

export const Section = ({ heading, children }) => (
  <section className="mb-10">
    {heading && (
      <h2 className="text-sm font-black uppercase tracking-widest text-zinc-100 mb-3">
        {heading}
      </h2>
    )}
    <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
      {children}
    </div>
  </section>
)

export const Note = ({ children }) => (
  <p className="border-l-4 border-amber-400/60 pl-4 py-2 text-xs text-amber-200/90 bg-amber-400/5">
    {children}
  </p>
)

const LegalPage = ({ title, lastUpdated, children }) => (
  <div className="bg-zinc-950 min-h-screen">
    <header className="header relative lg:overflow-hidden">
      <Navbar displayLinks={false} />
    </header>
    <ScrollToTop smooth />
    <div className="pt-20 lg:container lg:mx-auto">
      <div className="px-6 lg:px-12 py-12">
        <div className="flex items-center gap-6 mb-4 border-b border-zinc-800/60 pb-8">
          <Link
            title="Back to store"
            to="/merch"
            className="text-zinc-400 hover:text-amber-400 transition-colors text-2xl leading-none"
          >
            &larr;
          </Link>
          <div className="flex items-center gap-4 flex-1">
            <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-widest text-white">
              {title}
            </h1>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>
        </div>
        {lastUpdated && (
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-10">
            Last updated · {lastUpdated}
          </p>
        )}
        <div className="max-w-3xl">{children}</div>
      </div>
      <Footer />
    </div>
  </div>
)

export default LegalPage
