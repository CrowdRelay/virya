import { useEffect, useState } from "preact/hooks"
import type { Lang } from "../../../i18n/t"
import type { AdmissionPass, AdmissionQr } from "../../../lib/crowdrelay-client"
import { crowdrelay } from "../../../lib/crowdrelay"
import { qrDataUrl } from "../../../lib/qr"

interface Props {
  lang: Lang
  pass: AdmissionPass
}

type QrState =
  | { kind: "loading" }
  | { kind: "ready"; qr: AdmissionQr }
  | { kind: "unavailable" }

const text = {
  pl: {
    eyebrow: "VIRYA // WEJŚCIÓWKA",
    title: "Twoja darmowa wejściówka",
    show: "Otwórz ten ekran przy wejściu. Kod zmienia się automatycznie i działa tylko z Twoją prywatną sesją.",
    loading: "Generuję bezpieczny QR…",
    used: "Wejściówka została już wykorzystana.",
    unavailable: "Wejściówka jest anulowana albo wygasła.",
  },
  en: {
    eyebrow: "VIRYA // GUEST PASS",
    title: "Your free admission pass",
    show: "Open this screen at the door. The QR rotates automatically and works only with your private session.",
    loading: "Generating a secure QR…",
    used: "This pass has already been redeemed.",
    unavailable: "This pass has been revoked or has expired.",
  },
} as const

export default function AdmissionPassCard({ lang, pass }: Props) {
  const copy = text[lang]
  const [qrState, setQrState] = useState<QrState>({ kind: "loading" })

  useEffect(() => {
    if (pass.status !== "claimed") return
    let cancelled = false
    let timer: number | undefined

    const load = async () => {
      try {
        const qr = await crowdrelay.getAdmissionQr()
        if (cancelled) return
        setQrState({ kind: "ready", qr })
        const delay = Math.max(5_000, Date.parse(qr.expires_at) - Date.now() - 12_000)
        timer = window.setTimeout(load, delay)
      } catch {
        if (!cancelled) setQrState({ kind: "unavailable" })
      }
    }
    void load()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [pass.pass_id, pass.status])

  return (
    <section class="virya-panel overflow-hidden border-amber-400/35 bg-amber-400/[.025]">
      <div class="border-b border-zinc-800 p-5 sm:p-6">
        <p class="text-[9px] font-black uppercase tracking-[.28em] text-amber-400">{copy.eyebrow}</p>
        <h2 class="mt-2 text-2xl font-black uppercase text-white">{copy.title}</h2>
        <p class="mt-3 font-mono text-[10px] tracking-widest text-zinc-400">{pass.public_reference}</p>
      </div>
      <div class="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_340px] md:items-center">
        <div>
          <h3 class="text-xl font-black uppercase text-white">{pass.event_title}</h3>
          <p class="mt-3 text-sm leading-relaxed text-zinc-300">
            {new Intl.DateTimeFormat(lang === "pl" ? "pl-PL" : "en-GB", { dateStyle: "full", timeStyle: "short" }).format(new Date(pass.starts_at))}
            {pass.venue ? ` · ${pass.venue}` : ""}
          </p>
          <p class="mt-5 text-xs leading-relaxed text-zinc-400">{copy.show}</p>
        </div>
        <div class="text-center">
          {pass.status === "claimed" && qrState.kind === "ready" ? (
            <img src={qrDataUrl(qrState.qr.token, 8, 4)} width="328" height="328" alt={`QR ${pass.public_reference}`} class="mx-auto aspect-square w-full max-w-[328px] bg-white p-2 [image-rendering:pixelated]" />
          ) : pass.status === "claimed" && qrState.kind === "loading" ? (
            <p class="border border-zinc-700 p-8 text-xs text-zinc-300" aria-busy="true">{copy.loading}</p>
          ) : pass.status === "redeemed" ? (
            <p class="border border-emerald-400/30 bg-emerald-400/[.035] p-8 text-sm font-bold text-emerald-200">{copy.used}</p>
          ) : (
            <p class="border border-red-400/30 bg-red-400/[.035] p-8 text-sm font-bold text-red-200">{copy.unavailable}</p>
          )}
        </div>
      </div>
    </section>
  )
}
