import { useState } from "preact/hooks"
import { IslandI18nProvider, useIslandI18n } from "../../i18n/IslandI18nContext"

const ContactInner = () => {
  const { t } = useIslandI18n()
  const [form, setForm] = useState({ name: "", email: "", message: "", website: "" })
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setStatus("success")
        setForm({ name: "", email: "", message: "", website: "" })
      } else {
        setStatus("error")
      }
    } catch {
      setStatus("error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="virya-section border-t border-zinc-800/60">
      <form name="contact" method="POST" onSubmit={handleSubmit} class="virya-section__inner">
        <div class="hidden" aria-hidden="true">
          <label for="contact-website">
            Website
          </label>
          <input
            id="contact-website"
            name="website"
            type="text"
            value={form.website}
            onInput={set("website")}
            tabIndex={-1}
            autocomplete="off"
            maxLength={200}
          />
        </div>
        <div class="mb-8">
          <p class="virya-eyebrow">VIRYA // CONTACT</p>
          <h2 class="virya-heading mt-4">{t("contact.heading")}</h2>
          <p class="virya-copy mt-5">{t("contact.sub")}</p>
        </div>

        <div class="mb-2 flex flex-wrap gap-x-4 gap-y-2">
          <a
            href="mailto:virya.crew@gmail.com"
            class="inline-flex items-center min-h-[44px] text-xs font-bold uppercase tracking-widest text-amber-400 hover:text-amber-200 transition-colors"
          >
            {t("contact.booking")}
          </a>
          <a
            href="https://drive.google.com/drive/folders/1M4pgB9goigGUm9tudcQIzORTgILgSABH?usp=drive_link"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center min-h-[44px] text-xs font-bold uppercase tracking-widest text-amber-400 hover:text-amber-200 transition-colors"
          >
            {t("contact.epk")}
          </a>
        </div>

        <div class="grid grid-cols-1 gap-8">
          <div>
            <div class="mt-6">
              <label for="contact-name" class="uppercase text-xs font-semibold tracking-widest text-zinc-400">
                {t("contact.name")}
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                required
                maxLength={100}
                value={form.name}
                onInput={set("name")}
                class="virya-input mt-2 p-3"
              />
            </div>
            <div class="mt-6">
              <label for="contact-email" class="uppercase text-xs font-semibold tracking-widest text-zinc-400">
                {t("contact.email")}
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                maxLength={254}
                value={form.email}
                onInput={set("email")}
                autocomplete="email"
                class="virya-input mt-2 p-3"
              />
            </div>
            <div class="mt-6">
              <label for="contact-message" class="uppercase text-xs font-semibold tracking-widest text-zinc-400">
                {t("contact.message")}
              </label>
              <textarea
                id="contact-message"
                name="message"
                required
                maxLength={5000}
                value={form.message}
                onInput={set("message")}
                class="virya-input mt-2 h-36 resize-y p-3"
              />
            </div>
            <div class="mt-6 mb-8">
              <button
                type="submit"
                disabled={loading || !form.message || !form.name || !form.email}
                class="virya-button virya-button--primary w-full py-3 px-4"
              >
                {t("contact.send")}
              </button>
              <div role="alert" aria-live="assertive">
                {status === "error" && (
                  <p class="text-xs uppercase tracking-widest text-red-400 mt-3">
                    {t("contact.error")}
                  </p>
                )}
                {status === "success" && (
                  <p class="text-xs uppercase tracking-widest text-amber-400 mt-3">
                    {t("contact.thankBody")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

const Contact = ({ lang, messages }) => (
  <IslandI18nProvider lang={lang} messages={messages}>
    <ContactInner />
  </IslandI18nProvider>
)

export default Contact
