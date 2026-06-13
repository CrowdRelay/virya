"use client"
import React, { memo, useState, useEffect } from 'react'
import ShowItem from './show'

const APP_ID = '3cfcaea901e7597c0e1b683b76a2a134'
const API_URL = `https://rest.bandsintown.com/artists/virya/events?app_id=${APP_ID}`

const normalizeEvent = (event) => {
    if (!event) return null
    const lineup = Array.isArray(event.lineup) ? event.lineup.join(', ') : ''
    const venue = event.venue ? `${event.venue.name ?? ''}, ${event.venue.city ?? ''}` : ''
    return {
        title: lineup && venue ? `${lineup} | ${venue}` : lineup || venue || 'Show',
        date: event.datetime,
        event: event.url || null,
        tickets: event.offers?.find(o => o?.type === 'Tickets')?.url ?? null
    }
}

const SkeletonRow = () => (
    <div className="border-l-2 border-zinc-700/50 pl-4 py-4 bg-zinc-900/30">
        <div className="h-4 w-2/3 bg-zinc-700/50 animate-pulse mb-2" />
        <div className="h-3 w-1/4 bg-zinc-800/50 animate-pulse" />
    </div>
)

const Shows = memo(() => {
    const [shows, setShows] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)

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
                    setShows(Array.isArray(data) ? data.map(normalizeEvent).filter(Boolean) : [])
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
    }, [])

    return (
        <div className="py-16 lg:px-8 border-t border-zinc-800/60">
            <div className="mx-4">
                <div className="flex items-center gap-4 mb-2">
                    <p className="text-3xl font-black uppercase tracking-widest whitespace-nowrap">Shows</p>
                    <div className="flex-1 h-px bg-zinc-800" />
                </div>
                <p className="text-zinc-400 text-xs uppercase tracking-widest mb-8">Upcoming live dates</p>
                <div className="flex flex-col gap-1.5">
                    {loading ? (
                        <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
                    ) : shows.length === 0 ? (
                        <p className="text-zinc-400 text-xs uppercase tracking-widest border-l-2 border-zinc-700 pl-4 py-4">No upcoming shows at the moment.</p>
                    ) : (
                        shows.map((item, index) => (
                            <ShowItem key={index} item={item} />
                        ))
                    )}
                </div>
            </div>
        </div>
    )
})

export default Shows