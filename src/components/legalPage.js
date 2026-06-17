"use client"
import React from "react"
import { Link } from "gatsby"
import Navbar from "./nav"
import Footer from "./footer"
import { ScrollToTop } from "./scrollToTop/scroll"
import { useI18n } from "../i18n/I18nContext"

const Run = ({ run, lp }) => {
  if (run.link) {
    const external = run.link.href.startsWith("http")
    const href = external ? run.link.href : lp(run.link.href)
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-amber-400 underline underline-offset-2"
        >
          {run.link.label}
        </a>
      )
    }
    return (
      <Link
        to={href}
        className="text-amber-400 underline underline-offset-2"
      >
        {run.link.label}
      </Link>
    )
  }
  if (run.em) return <em>{run.em}</em>
  if (run.code) return <code className="text-amber-400">{run.code}</code>
  return <>{run.t}</>
}

const Section = ({ section, lp }) => (
  <section className="mb-10">
    {section.heading && (
      <h2 className="text-sm font-black uppercase tracking-widest text-zinc-100 mb-3">
        {section.heading}
      </h2>
    )}
    <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
      {section.paras.map((runs, i) => (
        <p key={i}>
          {runs.map((run, j) => (
            <Run key={j} run={run} lp={lp} />
          ))}
        </p>
      ))}
      {section.list && (
        <ul className="list-disc pl-5 space-y-1">
          {section.list.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  </section>
)

const LegalPage = ({ pageKey }) => {
  const { t, lp } = useI18n()
  const page = t(`legal.${pageKey}`)
  return (
    <div className="bg-zinc-950 min-h-screen">
      <header className="header relative lg:overflow-hidden">
        <Navbar displayLinks={false} />
      </header>
      <ScrollToTop smooth />
      <div className="pt-20 lg:container lg:mx-auto">
        <div className="px-6 lg:px-12 py-12">
          <div className="flex items-center gap-6 mb-4 border-b border-zinc-800/60 pb-8">
            <Link
              title={t("legal.back")}
              to={lp("/merch")}
              className="text-zinc-400 hover:text-amber-400 transition-colors text-2xl leading-none"
            >
              &larr;
            </Link>
            <div className="flex items-center gap-4 flex-1">
              <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-widest text-white">
                {page.title}
              </h1>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
          </div>
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-10">
            {t("legal.lastUpdated")} · {t("legal.date")}
          </p>
          <div className="max-w-3xl">
            {page.sections.map((section, i) => (
              <Section key={i} section={section} lp={lp} />
            ))}
          </div>
        </div>
        <Footer />
      </div>
    </div>
  )
}

export default LegalPage
