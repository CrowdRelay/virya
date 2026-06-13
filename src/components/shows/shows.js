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
        <div className="bg-stone-900 py-8 lg:px-8 lg:rounded-b-2xl">
            <div className="text-center mb-8 mx-4">
                <p className="text-4xl font-bold leading-tight my-4">Shows</p>
                <p className="italic w-full my-4">Make sure you're not missing out our upcoming shows</p>
                <div className="grid grid-cols-1 gap-4 overflow-hidden relative my-8">
                    {loading ? (
                        <p className="text-stone-400 italic">Loading upcoming shows...</p>
                    ) : shows.length === 0 ? (
                        <p className="text-stone-400 italic">No upcoming shows at the moment.</p>
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