import { useMemo, useState } from "preact/hooks"
import { staffApi } from "./staffApi"
import {
  staffAccentButton,
  staffAccentChip,
  staffBadge,
  staffEmpty,
  staffEyebrow,
  staffEyebrowAccent,
  staffField,
  staffNoticeBase,
  staffNoticeTones,
  staffPanelInset,
  staffSecondaryButton,
  staffSubtitle,
} from "./staffUi"

type Pool = {
  activeReleaseLatarnicy: number
  contactableLatarnicy: number
  missingEmail: number
}

type Campaign = {
  id: string
  slug: string
  title: string
  sku: string
  productName: string
  variantLabel: string
  status: "draft" | "open" | "closed" | "cancelled"
  claimDeadline: string
  eligibleCount: number
  reservedQuantity: number
  notifiedCount: number
  confirmedCount: number
  preparedCount: number
  sentCount: number
  deliveredCount: number
  declinedCount: number
  expiredCount: number
}

type Recipient = {
  campaignId: string
  beaconId: string
  displayName: string
  beaconKind: string
  city?: string | null
  status: "eligible" | "notified" | "confirmed" | "prepared" | "sent" | "delivered" | "declined" | "expired" | "cancelled"
  recipientName?: string | null
  recipientPhone?: string | null
  parcelLockerCode?: string | null
  activationDueAt?: string | null
  activationQueuedAt?: string | null
  activationSuppressedAt?: string | null
}

export type BeaconReleaseOverview = {
  pool: Pool
  campaigns: Campaign[]
  recipients: Recipient[]
}

type Sku = {
  sku: string
  label: string
  available: number
}

type Props = {
  data: BeaconReleaseOverview
  skus: Sku[]
  disabled: boolean
  onRefresh: () => Promise<void>
}

const dateInput = (days: number) => {
  const date = new Date(Date.now() + days * 86_400_000)
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return shifted.toISOString().slice(0, 16)
}

const slugify = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 128)

const statusLabel = (value: Campaign["status"]) => ({
  draft: "SZKIC", open: "AKTYWNA", closed: "ZAMKNIĘTA", cancelled: "ANULOWANA",
})[value]

const recipientStatus = (value: Recipient["status"]) => ({
  eligible: "OCZEKUJE", notified: "POWIADOMIONY", confirmed: "PACZKOMAT OK", prepared: "PRZYGOTOWANA",
  sent: "WYSŁANA", delivered: "DOSTARCZONA", declined: "REZYGNACJA", expired: "WYGASŁA", cancelled: "ANULOWANA",
})[value]

export default function StaffLatarnikReleaseManager({ data, skus, disabled, onRefresh }: Props) {
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [sku, setSku] = useState(skus[0]?.sku ?? "")
  const [deadline, setDeadline] = useState(dateInput(14))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const selected = skus.find(item => item.sku === sku)
  const pool = data.pool ?? { activeReleaseLatarnicy: 0, contactableLatarnicy: 0, missingEmail: 0 }
  const launchBlocked = pool.activeReleaseLatarnicy <= 0
    || pool.missingEmail > 0
    || !selected
    || selected.available < pool.activeReleaseLatarnicy

  const recipientsByCampaign = useMemo(() => {
    const result = new Map<string, Recipient[]>()
    for (const recipient of data.recipients ?? []) {
      const rows = result.get(recipient.campaignId) ?? []
      rows.push(recipient)
      result.set(recipient.campaignId, rows)
    }
    return result
  }, [data.recipients])

  const post = async (body: Record<string, unknown>) => staffApi<Record<string, unknown>>(
    "/api/staff/commerce/campaigns",
    { method: "POST", body, timeoutMs: 15_000 },
  )

  const create = async (launch: boolean) => {
    const cleanTitle = title.trim()
    const cleanSlug = (slug || slugify(cleanTitle)).trim()
    if (!cleanTitle || !cleanSlug || !sku || !deadline) return
    setBusy(true); setMessage(launch ? "Tworzę kampanię i rezerwuję pulę…" : "Zapisuję szkic…")
    try {
      const created = await post({
        kind: "beacon_release", action: "create", title: cleanTitle, slug: cleanSlug,
        sku, claimDeadline: new Date(deadline).toISOString(),
      })
      const campaignId = typeof created.campaignId === "string" ? created.campaignId : ""
      if (launch) {
        if (!campaignId) throw new Error("missing campaign id")
        await post({ kind: "beacon_release", action: "launch", campaignId })
        setMessage(`Uruchomione. CrowdRelay zarezerwował ${pool.activeReleaseLatarnicy} szt. i zakolejkował wiadomości do Latarników.`)
      } else {
        setMessage("Szkic zapisany. Stock nie został jeszcze zarezerwowany.")
      }
      setTitle(""); setSlug("")
      await onRefresh()
    } catch (error) {
      setMessage(error instanceof Error && error.message ? `Nie udało się: ${error.message}` : "Nie udało się zapisać kampanii.")
    } finally { setBusy(false) }
  }

  const action = async (body: Record<string, unknown>, success: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true); setMessage("Zapisuję…")
    try {
      await post({ kind: "beacon_release", ...body })
      setMessage(success)
      await onRefresh()
    } catch (error) {
      setMessage(error instanceof Error && error.message ? `Nie udało się: ${error.message}` : "Nie udało się wykonać operacji.")
    } finally { setBusy(false) }
  }

  return (
    <section class="rounded-lg border border-virya-signal/25 bg-gradient-to-br from-virya-signal/[0.06] to-virya-bg p-5 sm:p-7">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class={staffEyebrowAccent}>Latarnik / physical release</p>
          <h2 class="mt-2 text-2xl font-black text-virya-text sm:text-3xl">Płyty dla aktywnych Latarników</h2>
          <p class={`mt-3 max-w-3xl ${staffSubtitle}`}>
            Jedna kampania = jedno fizyczne wydanie. Launch robi świeży snapshot aktywnych Latarników, rezerwuje po 1 sztuce SKU i kolejkuje mail „Dziękujemy Latarniku…”. Wysyłasz tylko osobom, które potwierdzą Paczkomat.
          </p>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center text-xs">
          <Metric label="AKTYWNI" value={pool.activeReleaseLatarnicy} />
          <Metric label="KONTAKT" value={pool.contactableLatarnicy} />
          <Metric label="BRAK MAILA" value={pool.missingEmail} warn={pool.missingEmail > 0} />
        </div>
      </div>

      <div class="mt-6 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
        <label class={`grid gap-2 ${staffField} lg:col-span-2`}>
          Nazwa wydania
          <input value={title} onInput={event => { setTitle(event.currentTarget.value); if (!slug) setSlug(slugify(event.currentTarget.value)) }} placeholder="np. Echoes Of The Modern Mind — LP 2026" class="input" />
        </label>
        <label class={`grid gap-2 ${staffField}`}>
          Slug
          <input value={slug} onInput={event => setSlug(slugify(event.currentTarget.value))} placeholder="echoes-lp-2026" class="input" />
        </label>
        <label class={`grid gap-2 ${staffField} lg:col-span-2`}>
          Fizyczny SKU
          <select value={sku} onChange={event => setSku(event.currentTarget.value)} class="input">
            {skus.map(item => <option value={item.sku}>{item.label} · dostępne {item.available}</option>)}
          </select>
        </label>
        <label class={`grid gap-2 ${staffField}`}>
          Paczkomat potwierdź do
          <input type="datetime-local" value={deadline} onInput={event => setDeadline(event.currentTarget.value)} class="input" />
        </label>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={disabled || busy || !title.trim() || !sku} onClick={() => void create(false)} class={staffSecondaryButton}>ZAPISZ SZKIC</button>
        <button type="button" disabled={disabled || busy || !title.trim() || !sku || launchBlocked} onClick={() => {
          if (window.confirm(`Uruchomić kampanię dla ${pool.activeReleaseLatarnicy} aktywnych Latarników i zarezerwować ${pool.activeReleaseLatarnicy} szt. ${sku}?`)) void create(true)
        }} class={staffAccentButton}>UTWÓRZ I URUCHOM</button>
      </div>
      {launchBlocked ? (
        <p class="mt-3 text-xs leading-5 text-virya-warning">
          Launch zablokowany: potrzebujesz co najmniej 1 aktywnego Latarnika, kompletnego maila dla całej aktywnej puli i stocku ≥ {pool.activeReleaseLatarnicy}. {selected ? `Wybrany SKU ma teraz ${selected.available} dostępnych szt.` : "Wybierz SKU."}
        </p>
      ) : null}
      {message ? <p class={`mt-4 ${staffNoticeBase} ${staffNoticeTones.warn}`} role="status">{message}</p> : null}

      <div class="mt-7 grid gap-4">
        {(data.campaigns ?? []).length === 0 ? (
          <p class={staffEmpty}>Nie ma jeszcze kampanii fizycznych wydań.</p>
        ) : data.campaigns.map(campaign => {
          const recipients = recipientsByCampaign.get(campaign.id) ?? []
          return (
            <article key={campaign.id} class={`${staffPanelInset} sm:p-5`}>
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="font-black text-virya-text">{campaign.title}</p>
                  <p class="mt-1 text-xs text-virya-muted">{campaign.productName} · {campaign.variantLabel} · {campaign.sku}</p>
                </div>
                <span class={staffBadge}>{statusLabel(campaign.status)}</span>
              </div>
              <div class="mt-4 grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                <Metric label="PULA" value={campaign.eligibleCount} />
                <Metric label="MAIL" value={campaign.notifiedCount} />
                <Metric label="PACZKOMAT" value={campaign.confirmedCount} />
                <Metric label="GOTOWE" value={campaign.preparedCount} />
                <Metric label="WYSŁANE" value={campaign.sentCount} />
                <Metric label="DOSTARCZ." value={campaign.deliveredCount} />
              </div>
              {campaign.status === "draft" ? (
                <button type="button" disabled={disabled || busy || launchBlocked} onClick={() => void action(
                  { action: "launch", campaignId: campaign.id },
                  "Kampania uruchomiona i maile zakolejkowane.",
                  `Uruchomić „${campaign.title}” dla aktualnej pełnej puli Latarników?`,
                )} class={`${staffAccentChip} mt-4`}>URUCHOM</button>
              ) : campaign.status === "open" ? (
                <button type="button" disabled={disabled || busy || campaign.confirmedCount + campaign.preparedCount > 0} onClick={() => void action(
                  { action: "close", campaignId: campaign.id },
                  "Kampania zamknięta; niewykorzystana rezerwacja wróciła do stocku.",
                  `Zamknąć „${campaign.title}”? Osoby bez potwierdzenia wygasną, a niewykorzystany stock zostanie zwolniony.`,
                )} class={`mt-4 ${staffSecondaryButton}`}>ZAMKNIJ KAMPANIĘ</button>
              ) : null}

              {recipients.length ? (
                <div class="mt-5 grid gap-2">
                  {recipients.map(person => (
                    <div key={person.beaconId} class="rounded-lg border border-virya-edge/60 bg-virya-bg/70 p-3">
                      <div class="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <strong class="text-sm text-virya-text">{person.displayName}</strong>
                          <span class="ml-2 text-xs text-virya-muted">{person.city || person.beaconKind}</span>
                          {person.recipientName && person.parcelLockerCode ? (
                            <p class="mt-1 text-xs text-virya-text">{person.recipientName} · {person.recipientPhone} · <strong class="text-virya-hot">{person.parcelLockerCode}</strong></p>
                          ) : null}
                          {person.status === "delivered" && person.activationDueAt ? (
                            <p class="mt-1 text-[11px] text-virya-muted">
                              {person.activationQueuedAt
                                ? "Aktywizacja zakolejkowana."
                                : person.activationSuppressedAt
                                  ? "Aktywizacja pominięta (brak zgody/kontaktu)."
                                  : `Follow-up najwcześniej ${new Date(person.activationDueAt).toLocaleString("pl-PL")}.`}
                            </p>
                          ) : null}
                        </div>
                        <span class={staffEyebrow}>{recipientStatus(person.status)}</span>
                      </div>
                      <div class="mt-3 flex flex-wrap gap-2">
                        {person.status === "confirmed" && <button type="button" disabled={busy} onClick={() => void action({ action: "recipient-status", campaignId: campaign.id, beaconId: person.beaconId, status: "prepared" }, `${person.displayName}: przygotowana.`)} class={staffAccentChip}>PRZYGOTOWANA</button>}
                        {["confirmed", "prepared"].includes(person.status) && <button type="button" disabled={busy} onClick={() => void action({ action: "recipient-status", campaignId: campaign.id, beaconId: person.beaconId, status: "sent" }, `${person.displayName}: wysłana; zapisano promotional_issue.`)} class={staffAccentChip}>WYSŁANA</button>}
                        {person.status === "sent" && <button type="button" disabled={busy} onClick={() => void action({ action: "recipient-status", campaignId: campaign.id, beaconId: person.beaconId, status: "delivered" }, `${person.displayName}: dostarczona.`)} class={staffAccentChip}>DOSTARCZONA</button>}
                        {["notified", "confirmed", "prepared"].includes(person.status) && <button type="button" disabled={busy} onClick={() => void action({ action: "recipient-status", campaignId: campaign.id, beaconId: person.beaconId, status: "cancelled" }, `${person.displayName}: anulowana i zwolniono sztukę.`, `Anulować egzemplarz dla ${person.displayName}?`)} class="virya-button min-h-[44px] min-w-0 border border-virya-danger/30 px-3 text-[10px] text-rose-200 transition-colors hover:border-virya-danger/50 disabled:opacity-50">ANULUJ</button>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function Metric({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return <div class={`rounded-lg border px-2 py-2 ${warn ? "border-virya-danger/30 bg-virya-danger/10" : "border-virya-edge bg-virya-surface/80"}`}>
    <strong class={`block text-lg ${warn ? "text-rose-200" : "text-virya-text"}`}>{value}</strong>
    <span class="text-[9px] font-black tracking-wider text-virya-muted">{label}</span>
  </div>
}
