"use client"
import React, { memo } from 'react'

const Button = memo(({ title, href }) => (
  <a href={href} rel="noreferrer" target="_blank">
    <button className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-amber-400/60 text-amber-400 hover:bg-amber-400 hover:text-black transition-all duration-200">
      {title}
    </button>
  </a>
))

const ShowItem = memo(({ item }) => {
  const date = new Date(item.date)
  const today = new Date()
  const normalizedDate = date.setHours(0, 0, 0, 0)
  const normalizedToday = today.setHours(0, 0, 0, 0)

  if (normalizedDate >= normalizedToday) {
    const isToday = normalizedDate === normalizedToday
    const dateLabel = isToday
      ? '🔴 Today'
      : date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'short', day: 'numeric' })

    return (
      <div className={`border-l-2 ${isToday ? 'border-red-500 bg-red-950/20' : 'border-amber-400/40 bg-zinc-900/40'} hover:bg-zinc-800/50 transition-colors pl-4 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3`}>
        <div className="text-left">
          <p className="font-bold lg:text-base text-sm leading-tight">{item.title}</p>
          <p className={`text-xs mt-1 font-semibold uppercase tracking-wider ${isToday ? 'text-red-400' : 'text-amber-400/70'}`}>{dateLabel}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {item.event && <Button title="Event" href={item.event} />}
          {item.tickets && <Button title="Tickets" href={item.tickets} />}
        </div>
      </div>
    )
  }
  return null
})

export default ShowItem