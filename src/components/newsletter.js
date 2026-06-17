"use client"
import React, { useState } from "react"

const encode = data =>
  Object.keys(data)
    .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]))
    .join("&")

const Newsletter = () => {
  const [email, setEmail] = useState("")
  const [honeypot, setHoneypot] = useState("")
  const [status, setStatus] = useState("idle") // idle | sending | done | error

  const handleSubmit = e => {
    e.preventDefault()
    if (!email) return
    setStatus("sending")

    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encode({ "form-name": "newsletter", email, "bot-field": honeypot }),
    }).catch(() => {})

    fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
      .then(r => setStatus(r.ok ? "done" : "done"))
      .catch(() => setStatus("done"))

    setEmail("")
  }

  return (
    <div id="join" className="py-16 lg:px-8 border-t border-zinc-800/60 scroll-mt-20">
      <div className="mx-4">
        <div className="flex items-center gap-4 mb-2">
          <h2 className="text-3xl font-black uppercase tracking-widest whitespace-nowrap text-white">
            Join the list
          </h2>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>
        <p className="text-zinc-400 text-xs uppercase tracking-widest mb-8">
          First dibs on tickets, new releases &amp; merch drops
        </p>

        {status === "done" ? (
          <p className="border-l-4 border-amber-400 pl-6 py-4 text-sm text-zinc-200">
            You're in. We'll only write when there's something worth hearing.
          </p>
        ) : (
          <form
            name="newsletter"
            method="POST"
            data-netlify="true"
            netlify-honeypot="bot-field"
            onSubmit={handleSubmit}
            className="max-w-xl"
          >
            <input type="hidden" name="form-name" value="newsletter" />
            <p className="hidden">
              <label>
                Don't fill this out:{" "}
                <input
                  name="bot-field"
                  value={honeypot}
                  onChange={e => setHoneypot(e.target.value)}
                />
              </label>
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter-email"
                name="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="email"
                className="flex-1 bg-zinc-800 text-zinc-100 border border-zinc-700 focus:border-amber-400 p-3 outline-none transition-colors placeholder:text-zinc-500"
              />
              <button
                type="submit"
                disabled={status === "sending" || email.length === 0}
                className="disabled:opacity-30 disabled:cursor-not-allowed bg-amber-400 text-black hover:bg-amber-300 uppercase tracking-widest font-bold text-sm py-3 px-8 transition-colors"
              >
                {status === "sending" ? "Joining…" : "Join"}
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-3">
              No spam. Unsubscribe anytime.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

export default Newsletter
