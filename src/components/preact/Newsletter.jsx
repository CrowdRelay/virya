import { useState } from "preact/hooks"
import { IslandI18nProvider, useIslandI18n } from "../../i18n/IslandI18nContext"

const NewsletterInner = () => {
  const { t } = useIslandI18n()
  const [email, setEmail] = useState("")
  const [honeypot, setHoneypot] = useState("")
  const [status, setStatus] = useState("idle")

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || status === "sending") return
    setStatus("sending")

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website: honeypot }),
      })
      if (!response.ok) throw new Error("Subscription failed")
      setEmail("")
      setStatus("done")
    } catch {
      setStatus("error")
    }
  }

  return (
    <div id="join" class="virya-section scroll-mt-20 border-t border-zinc-800/60">
      <div class="virya-section__inner">
        <p class="virya-eyebrow">VIRYA // SIGNAL</p>
        <h2 class="virya-heading mt-4">{t("newsletter.heading")}</h2>
        <p class="virya-copy mt-5 mb-8">{t("newsletter.sub")}</p>

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
                class="virya-input flex-1 p-3 placeholder:text-zinc-400"
              />
              <button
                type="submit"
                disabled={status === "sending" || email.length === 0}
                class="virya-button virya-button--primary py-3 px-8"
              >
                {status === "sending" ? t("newsletter.joining") : t("newsletter.join")}
              </button>
            </div>
            <p class="text-[10px] text-zinc-400 uppercase tracking-widest mt-3">
              {t("newsletter.noSpam")}
            </p>
            {status === "error" && (
              <p class="mt-3 text-xs uppercase tracking-widest text-red-400" role="alert">
                {t("contact.error")}
              </p>
            )}
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
