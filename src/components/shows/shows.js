"use client"
import React, { memo, useState, useEffect, useRef } from "react"
import ShowItem from "./show"
import { useI18n } from "../../i18n/I18nContext"

const API_URL = `/api/bandsintown`
const BANDSINTOWN_API_TIMEOUT = 20000

const normalizeEvent = event => {
  if (!event) return null
  const lineup = Array.isArray(event.lineup) ? event.lineup.join(", ") : ""
  const venue = event.venue
    ? `${event.venue.name ?? ""}, ${event.venue.city ?? ""}`
    : ""
  return {
    title: lineup && venue ? `${lineup} | ${venue}` : lineup || venue || "Show",
    date: event.datetime,
    event: event.url || null,
    tickets: event.offers?.find(o => o?.type === "Tickets")?.url ?? null,
    venueName: event.venue?.name ?? null,
    city: [event.venue?.city, event.venue?.country].filter(Boolean).join(", "),
  }
}

const buildEventSchema = shows =>
  JSON.stringify({
    "@context": "https://schema.org",
    "@graph": shows
      .filter(s => s.date)
      .map(s => ({
        "@type": "MusicEvent",
        name: s.title,
        startDate: s.date,
        ...(s.event ? { url: s.event } : {}),
        eventStatus: "https://schema.org/EventScheduled",
        performer: { "@type": "MusicGroup", name: "Virya" },
        ...(s.venueName
          ? {
              location: {
                "@type": "Place",
                name: s.venueName,
                address: s.city || undefined,
              },
            }
          : {}),
        ...(s.tickets
          ? {
              offers: {
                "@type": "Offer",
                url: s.tickets,
                availability: "https://schema.org/InStock",
              },
            }
          : {}),
      })),
  })

const SkeletonRow = () => (
  <div className="border-l-2 border-zinc-700/50 pl-4 py-4 bg-zinc-900/30">
    <div className="h-4 w-2/3 bg-zinc-700/50 animate-pulse mb-2" />
    <div className="h-3 w-1/4 bg-zinc-800/50 animate-pulse" />
  </div>
)

const Shows = memo(() => {
  const { t } = useI18n()
  const [shows, setShows] = useState([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { rootMargin: "400px" }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), BANDSINTOWN_API_TIMEOUT)

    const fetchShows = async () => {
      try {
        const res = await fetch(API_URL, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (!res.ok) {
          if (!cancelled) setShows([])
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setShows(
            Array.isArray(data) ? data.map(normalizeEvent).filter(Boolean) : []
          )
        }
      } catch {
      } finally {
        clearTimeout(timeoutId)
        if (!cancelled) setLoading(false)
      }
    }
    fetchShows()
    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timeoutId)
    }
  }, [visible])

  useEffect(() => {
    if (!shows.length || typeof document === "undefined") return
    const el = document.createElement("script")
    el.type = "application/ld+json"
    el.setAttribute("data-shows-schema", "")
    el.textContent = buildEventSchema(shows)
    document.head.appendChild(el)
    return () => el.remove()
  }, [shows])

  return (
    <div ref={ref} className="py-16 lg:px-8 border-t border-zinc-800/60">
      <div className="mx-4">
        <div className="flex items-center gap-4 mb-2">
          <p className="text-3xl font-black uppercase tracking-widest whitespace-nowrap text-white">
            {t("shows.heading")}
          </p>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>
        <p className="text-zinc-400 text-xs uppercase tracking-widest mb-8">
          {t("shows.sub")}
        </p>
        <div className="flex flex-col gap-1.5">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : shows.length === 0 ? (
            <div className="border-l-2 border-zinc-700 pl-4 py-4">
              <p className="text-zinc-400 text-xs uppercase tracking-widest">
                {t("shows.none")}
              </p>
              <a
                href="#join"
                className="inline-flex items-center gap-2 mt-3 text-xs font-bold uppercase tracking-widest text-amber-400 hover:text-amber-200 transition-colors"
              >
                {t("shows.joinCta")}
                <span aria-hidden="true">&rarr;</span>
              </a>
            </div>
          ) : (
            shows.map((item, index) => <ShowItem key={index} item={item} />)
          )}
        </div>
      </div>
    </div>
  )
})

export default Shows
