import { useState } from "preact/hooks"
import { IslandI18nProvider, useIslandI18n } from "../../i18n/IslandI18nContext"

const NewsletterInner = () => {
  const { t } = useIslandI18n()
  const [email, setEmail] = useState("")
  const [honeypot, setHoneypot] = useState("")
  const [status, setStatus] = useState("idle")

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!email) return
    setStatus("sending")

    fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, website: honeypot }),
    })
      .then(() => setStatus("done"))
      .catch(() => setStatus("done"))

    setEmail("")
  }

  return (
    <div id="join" class="py-16 lg:px-8 border-t border-zinc-800/60 scroll-mt-20">
      <div class="mx-4">
        <div class="flex items-center gap-4 mb-2">
          <h2 class="text-3xl font-black uppercase tracking-widest whitespace-nowrap text-white">
            {t("newsletter.heading")}
          </h2>
          <div class="flex-1 h-px bg-zinc-800" />
        </div>
        <p class="text-zinc-400 text-xs uppercase tracking-widest mb-8">{t("newsletter.sub")}</p>

        {status === "done" ? (
          <p class="border-l-4 border-amber-400 pl-6 py-4 text-sm text-zinc-200">
            {t("newsletter.success")}
          </p>
        ) : (
          <form onSubmit={handleSubmit} class="max-w-xl">
            <p class="hidden" aria-hidden="true">
              <label>
                Don't fill this out:{" "}
                <input
                  name="website"
                  tabIndex={-1}
                  autocomplete="off"
                  maxLength={200}
                  value={honeypot}
                  onInput={(e) => setHoneypot(e.target.value)}
                />
              </label>
            </p>
            <div class="flex flex-col sm:flex-row gap-3">
              <label for="newsletter-email" class="sr-only">{t("contact.email")}</label>
              <input
                id="newsletter-email"
                name="email"
                type="email"
                required
                maxLength={254}
                value={email}
                onInput={(e) => setEmail(e.target.value)}
                placeholder={t("newsletter.placeholder")}
                autocomplete="email"
                class="flex-1 bg-zinc-800 text-zinc-100 border border-zinc-700 focus:border-amber-400 p-3 outline-none transition-colors placeholder:text-zinc-400"
              />
              <button
                type="submit"
                disabled={status === "sending" || email.length === 0}
                class="disabled:opacity-30 disabled:cursor-not-allowed bg-amber-400 text-black hover:bg-amber-300 uppercase tracking-widest font-bold text-sm py-3 px-8 transition-colors"
              >
                {status === "sending" ? t("newsletter.joining") : t("newsletter.join")}
              </button>
            </div>
            <p class="text-[10px] text-zinc-400 uppercase tracking-widest mt-3">
              {t("newsletter.noSpam")}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

const Newsletter = ({ lang, messages }) => (
  <IslandI18nProvider lang={lang} messages={messages}>
    <NewsletterInner />
  </IslandI18nProvider>
)

export default Newsletter
