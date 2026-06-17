"use client"
import React from "react"
import { Link } from "gatsby"
import Navbar from "../../components/nav"
import Footer from "../../components/footer"
import { useI18n } from "../../i18n/I18nContext"

const Cancel = () => {
  const { t, lp } = useI18n()
  return (
  <div className="bg-zinc-950 min-h-screen flex flex-col">
    <header className="header relative lg:overflow-hidden">
      <Navbar displayLinks={false} />
    </header>
    <div className="flex-1 flex items-center justify-center px-6 pt-20">
      <div className="max-w-md text-center">
        <p className="uppercase tracking-[0.3em] text-zinc-500 text-xs font-bold mb-4">
          {t("cancel.eyebrow")}
        </p>
        <h1 className="text-3xl lg:text-4xl font-black uppercase tracking-tight text-white mb-6">
          {t("cancel.title")}
        </h1>
        <p className="text-sm text-zinc-300 leading-relaxed mb-8">
          {t("cancel.body")}
        </p>
        <Link
          to={lp("/merch")}
          className="inline-block bg-amber-400 text-black hover:bg-amber-300 uppercase tracking-widest font-bold text-sm py-3 px-8 transition-all duration-200"
        >
          {t("cancel.back")}
        </Link>
      </div>
    </div>
    <Footer />
  </div>
  )
}

export const Head = () => (
  <>
    <title>Payment cancelled | Virya</title>
    <meta name="robots" content="noindex" />
    <meta name="theme-color" content="#09090b" />
  </>
)

export default Cancel
