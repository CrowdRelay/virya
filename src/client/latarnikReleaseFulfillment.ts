type Lang = "pl" | "en"

type ReleaseCampaign = {
  campaignId: string
  slug: string
  title: string
  productName: string
  variantLabel: string
  status: "open" | "closed"
  recipientStatus: "eligible" | "notified" | "confirmed" | "prepared" | "sent" | "delivered" | "declined" | "expired" | "cancelled"
  claimDeadline: string
  recipientName?: string | null
  recipientPhone?: string | null
  parcelLockerCode?: string | null
}

type ReleasesResponse = { campaigns?: ReleaseCampaign[] }
type Api = (path: string, options?: RequestInit) => Promise<Response>

const buttonClass = "min-h-11 border px-4 text-[11px] font-black uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50"
const inputClass = "min-h-11 w-full border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-amber-400 focus:outline-none"

const copy = (lang: Lang) => lang === "pl" ? {
  empty: "Nie ma teraz fizycznego wydania wymagającego potwierdzenia. Gdy wytłoczymy kolejną płytę, aktywna kampania pojawi się tutaj i dostaniesz wiadomość.",
  reserved: "Ten egzemplarz jest dla Ciebie zarezerwowany. Potwierdź dane dla tej konkretnej wysyłki.",
  receiver: "Imię i nazwisko odbiorcy",
  phone: "Telefon do przesyłki",
  locker: "Kod Paczkomatu, np. WRO01A",
  confirm: "Potwierdź Paczkomat",
  decline: "Tym razem rezygnuję",
  declineConfirm: "Zrezygnować z egzemplarza tej premiery? Zarezerwowana sztuka wróci do puli.",
  saving: "Zapisuję…",
  saved: "Dziękujemy Latarniku — dane wysyłki są potwierdzone.",
  failed: "Nie udało się zapisać. Spróbuj ponownie.",
  declined: "Ta wysyłka została zwolniona z Twojej puli.",
  deadline: "Potwierdź do",
  help: "Jeśli chcesz pomóc tej premierze: recenzja/wzmianka, radio lub podcast, zdjęcia/wideo, udostępnienie albo kontakt do sensownego medium, promotora czy klubu. Nic z tego nie jest obowiązkiem.",
  press: "Otwórz Press Room",
} : {
  empty: "There is no physical release waiting for confirmation right now. When the next record is pressed, the campaign will appear here and you will receive a message.",
  reserved: "This copy is reserved for you. Confirm the delivery details for this release.",
  receiver: "Recipient name",
  phone: "Delivery phone",
  locker: "Parcel-locker code",
  confirm: "Confirm parcel locker",
  decline: "Skip this release",
  declineConfirm: "Skip your copy of this release? The reserved unit will return to the pool.",
  saving: "Saving…",
  saved: "Thank you, Beacon — your delivery details are confirmed.",
  failed: "Could not save. Please try again.",
  declined: "This copy has been released from your allocation.",
  deadline: "Confirm by",
  help: "If you want to help this release: a review/mention, radio or podcast, photos/video, a share, or a useful media/promoter/venue introduction. None of this is an obligation.",
  press: "Open Press Room",
}

const statusLabel = (lang: Lang, status: ReleaseCampaign["recipientStatus"]) => {
  const pl: Record<ReleaseCampaign["recipientStatus"], string> = {
    eligible: "CZEKA NA POTWIERDZENIE", notified: "CZEKA NA POTWIERDZENIE", confirmed: "POTWIERDZONA",
    prepared: "PRZYGOTOWUJEMY", sent: "WYSŁANA", delivered: "DOSTARCZONA", declined: "POMINIĘTA", expired: "WYGASŁA", cancelled: "ANULOWANA",
  }
  const en: Record<ReleaseCampaign["recipientStatus"], string> = {
    eligible: "WAITING FOR CONFIRMATION", notified: "WAITING FOR CONFIRMATION", confirmed: "CONFIRMED",
    prepared: "PREPARING", sent: "SENT", delivered: "DELIVERED", declined: "SKIPPED", expired: "EXPIRED", cancelled: "CANCELLED",
  }
  return (lang === "pl" ? pl : en)[status]
}

const field = (placeholder: string, value: string, type = "text") => {
  const input = document.createElement("input")
  input.type = type
  input.placeholder = placeholder
  input.value = value
  input.className = inputClass
  input.autocomplete = type === "tel" ? "tel" : "off"
  return input
}

const dateLabel = (value: string, lang: Lang) => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat(lang === "pl" ? "pl-PL" : "en-GB", { dateStyle: "long" }).format(date)
}

export const renderLatarnikReleases = (
  root: HTMLElement,
  data: ReleasesResponse,
  api: Api,
  lang: Lang,
) => {
  const c = copy(lang)
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns : []
  root.replaceChildren()
  if (!campaigns.length) {
    const empty = document.createElement("p")
    empty.className = "text-sm leading-6 text-zinc-500"
    empty.textContent = c.empty
    root.append(empty)
    return
  }

  for (const campaign of campaigns) {
    const card = document.createElement("article")
    card.className = "border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6"
    const top = document.createElement("div")
    top.className = "flex flex-wrap items-start justify-between gap-3"
    const title = document.createElement("div")
    const heading = document.createElement("h3")
    heading.className = "text-xl font-black text-zinc-100"
    heading.textContent = campaign.title
    const product = document.createElement("p")
    product.className = "mt-1 text-xs text-zinc-500"
    product.textContent = [campaign.productName, campaign.variantLabel].filter(Boolean).join(" · ")
    title.append(heading, product)
    const badge = document.createElement("span")
    badge.className = "border border-amber-400/40 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-amber-400"
    badge.textContent = statusLabel(lang, campaign.recipientStatus)
    top.append(title, badge)

    const intro = document.createElement("p")
    intro.className = "mt-4 text-sm leading-6 text-zinc-300"
    intro.textContent = `${c.reserved} ${c.deadline}: ${dateLabel(campaign.claimDeadline, lang)}.`
    card.append(top, intro)

    const canConfirm = campaign.status === "open"
      && ["eligible", "notified", "confirmed"].includes(campaign.recipientStatus)
      && new Date(campaign.claimDeadline).getTime() > Date.now()
    if (canConfirm) {
      const form = document.createElement("form")
      form.className = "mt-5 grid gap-3 lg:grid-cols-3"
      const name = field(c.receiver, campaign.recipientName || "")
      const phone = field(c.phone, campaign.recipientPhone || "", "tel")
      const locker = field(c.locker, campaign.parcelLockerCode || "")
      locker.autocapitalize = "characters"
      form.append(name, phone, locker)

      const actions = document.createElement("div")
      actions.className = "lg:col-span-3 flex flex-wrap gap-2"
      const confirm = document.createElement("button")
      confirm.type = "submit"
      confirm.className = `${buttonClass} border-amber-400 bg-amber-400 text-zinc-950 hover:bg-amber-300`
      confirm.textContent = c.confirm
      const decline = document.createElement("button")
      decline.type = "button"
      decline.className = `${buttonClass} border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200`
      decline.textContent = c.decline
      const status = document.createElement("p")
      status.className = "min-h-5 basis-full text-xs text-zinc-500"
      actions.append(confirm, decline, status)
      form.append(actions)

      const setBusy = (value: boolean) => {
        confirm.disabled = value
        decline.disabled = value
        name.disabled = value
        phone.disabled = value
        locker.disabled = value
      }
      form.addEventListener("submit", async event => {
        event.preventDefault()
        if (!name.value.trim() || !phone.value.trim() || !locker.value.trim()) return
        setBusy(true); status.textContent = c.saving
        try {
          const response = await api(`beacon/me/releases/${encodeURIComponent(campaign.campaignId)}/delivery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipientName: name.value.trim(),
              recipientPhone: phone.value.trim(),
              parcelLockerCode: locker.value.trim().toUpperCase(),
            }),
          })
          if (!response.ok) throw new Error(`release_delivery_${response.status}`)
          campaign.recipientStatus = "confirmed"
          badge.textContent = statusLabel(lang, "confirmed")
          status.textContent = c.saved
        } catch {
          status.textContent = c.failed
        } finally { setBusy(false) }
      })
      decline.addEventListener("click", async () => {
        if (!window.confirm(c.declineConfirm)) return
        setBusy(true); status.textContent = c.saving
        try {
          const response = await api(`beacon/me/releases/${encodeURIComponent(campaign.campaignId)}/decline`, { method: "POST" })
          if (!response.ok) throw new Error(`release_decline_${response.status}`)
          campaign.recipientStatus = "declined"
          badge.textContent = statusLabel(lang, "declined")
          form.remove()
          status.textContent = c.declined
        } catch {
          status.textContent = c.failed
          setBusy(false)
        }
      })
      card.append(form)
    }

    const help = document.createElement("p")
    help.className = "mt-5 border-t border-zinc-800 pt-4 text-xs leading-5 text-zinc-500"
    help.textContent = c.help
    const press = document.createElement("a")
    press.href = "#press-room"
    press.className = "mt-3 inline-flex min-h-10 items-center text-[10px] font-black uppercase tracking-wider text-amber-400 hover:text-amber-300"
    press.textContent = c.press
    card.append(help, press)
    root.append(card)
  }
}
