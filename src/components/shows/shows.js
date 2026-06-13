"use client"
import React, { memo, useState, useEffect } from 'react'
import ShowItem from './show'

const ARTIST_ID = 'id_15587796'
const APP_ID = '3cfcaea901e7597c0e1b683b76a2a134'
const API_URL = `https://rest.bandsintown.com/artists/${ARTIST_ID}/events?app_id=${APP_ID}`

const normalizeEvent = (event) => ({
    title: `${event.lineup.join(', ')} | ${event.venue.name}, ${event.venue.city}`,
    date: event.datetime,
    event: event.url,
    tickets: event.offers?.find(o => o.type === 'Tickets')?.url || null
})

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
        const fetchShows = async () => {
            try {
                const res = await fetch(API_URL)
                if (!res.ok) return
                const data = await res.json()
                if (!cancelled) {
                    setShows(Array.isArray(data) ? data.map(normalizeEvent) : [])
                }
            } catch {
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        fetchShows()
        return () => { cancelled = true }
    }, [])

    return (
        <div className="py-16 lg:px-8 border-t border-zinc-800/60">
            <div className="mx-4">
                <div className="flex items-center gap-4 mb-2">
                    <p className="text-3xl font-black uppercase tracking-widest whitespace-nowrap">Shows</p>
                    <div className="flex-1 h-px bg-zinc-800" />
                </div>
                <p className="text-zinc-500 text-xs uppercase tracking-widest mb-8">Upcoming live dates</p>
                <div className="flex flex-col gap-1.5">
                    {loading ? (
                        <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
                    ) : shows.length === 0 ? (
                        <p className="text-zinc-600 text-xs uppercase tracking-widest border-l-2 border-zinc-800 pl-4 py-4">No upcoming shows at the moment.</p>
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