import { useState } from "preact/hooks"
import { LanguageProvider, useI18n } from "../../i18n/I18nContext"

const ContactInner = () => {
  const { t } = useI18n()
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
    <div class="py-16 lg:px-8 border-t border-zinc-800/60">
      <form name="contact" method="POST" onSubmit={handleSubmit}>
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
        <div class="mx-4 mb-6">
          <div class="flex items-center gap-4 mb-2">
            <h2 class="text-3xl font-black uppercase tracking-widest whitespace-nowrap text-white">
              {t("contact.heading")}
            </h2>
            <div class="flex-1 h-px bg-zinc-800" />
          </div>
          <p class="text-zinc-400 text-xs uppercase tracking-widest">{t("contact.sub")}</p>
        </div>

        <div class="flex flex-wrap gap-x-6 gap-y-1 mb-2 px-4">
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
            <div class="mt-8 px-4">
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
                class="w-full bg-zinc-800 text-zinc-100 border border-zinc-700 focus:border-amber-400 mt-2 p-3 outline-none transition-colors"
              />
            </div>
            <div class="mt-8 px-4">
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
                class="w-full bg-zinc-800 text-zinc-100 border border-zinc-700 focus:border-amber-400 mt-2 p-3 outline-none transition-colors"
              />
            </div>
            <div class="mt-8 px-4">
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
                class="w-full h-32 bg-zinc-800 text-zinc-100 border border-zinc-700 focus:border-amber-400 mt-2 p-3 outline-none transition-colors resize-none"
              />
            </div>
            <div class="mt-8 px-4 mb-8">
              <button
                type="submit"
                disabled={loading || !form.message || !form.name || !form.email}
                class="disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer w-full bg-amber-400 text-black hover:bg-amber-300 uppercase tracking-widest font-bold text-sm py-3 px-4 transition-all duration-200 outline-none"
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

const Contact = ({ lang }) => (
  <LanguageProvider initialLang={lang}>
    <ContactInner />
  </LanguageProvider>
)

export default Contact
