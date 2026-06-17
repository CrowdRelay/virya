"use client"
import React, { useEffect } from "react"
import { Link } from "gatsby"
import Navbar from "../../components/nav"
import Footer from "../../components/footer"
import { useI18n } from "../../i18n/I18nContext"

const Success = () => {
  const { t, lang } = useI18n()
  const prefix = lang === "pl" ? "/pl" : ""
  useEffect(() => {
    try {
      window.localStorage.removeItem("virya-cart-v1")
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <div className="bg-zinc-950 min-h-screen flex flex-col">
      <header className="header relative lg:overflow-hidden">
        <Navbar displayLinks={false} />
      </header>
      <div className="flex-1 flex items-center justify-center px-6 pt-20">
        <div className="max-w-md text-center">
          <p className="uppercase tracking-[0.3em] text-amber-400 text-xs font-bold mb-4">
            {t("success.eyebrow")}
          </p>
          <h1 className="text-3xl lg:text-4xl font-black uppercase tracking-tight text-white mb-6">
            {t("success.title")}
          </h1>
          <p className="text-sm text-zinc-300 leading-relaxed mb-2">
            {t("success.body")}
          </p>
          <p className="text-sm text-amber-400/90 mb-8">
            {t("success.stickers")}
          </p>
          <Link
            to={`${prefix}/merch`}
            className="inline-block bg-amber-400 text-black hover:bg-amber-300 uppercase tracking-widest font-bold text-sm py-3 px-8 transition-all duration-200"
          >
            {t("success.back")}
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export const Head = () => (
  <>
    <title>Order confirmed | Virya</title>
    <meta name="robots" content="noindex" />
    <meta name="theme-color" content="#09090b" />
  </>
)

export default Success
