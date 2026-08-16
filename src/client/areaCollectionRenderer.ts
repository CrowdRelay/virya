type AreaDropReference = {
  citySlug: string
}

export type AreaLatestClaim = {
  dropId: string
  city: string
  citySlug: string
  line: string
}

type AreaCollectionRendererOptions = {
  root: HTMLElement
  copy: Record<string, string>
  drops: ReadonlyMap<string, AreaDropReference>
  claimedDrops: Set<string>
  buttons: HTMLElement[]
  lang: string
  renderSelected: (id: string) => void
  selectedId: () => string
}

export const createAreaCollectionRenderer = ({
  root,
  copy,
  drops,
  claimedDrops,
  buttons,
  lang,
  renderSelected,
  selectedId,
}: AreaCollectionRendererOptions) => {
  const renderClaims = (claims: any[]): AreaLatestClaim | null => {
    claimedDrops.clear()
    let latestClaim: AreaLatestClaim | null = null
    root.querySelectorAll<HTMLElement>("[data-collection-card]").forEach((card) => {
      card.classList.remove("is-unlocked")
      const locked = card.querySelector<HTMLElement>("[data-card-locked]")
      const unlocked = card.querySelector<HTMLElement>("[data-card-unlocked]")
      const state = card.querySelector<HTMLElement>("[data-card-state]")
      const line = card.querySelector<HTMLElement>("[data-card-line]")
      const track = card.querySelector<HTMLElement>("[data-card-track]")
      const riddle = card.querySelector<HTMLElement>("[data-card-riddle]")
      const meta = card.querySelector<HTMLElement>("[data-card-meta]")
      const artwork = card.querySelector<HTMLImageElement>("[data-card-artwork]")
      const artworkPlaceholder = card.querySelector<HTMLElement>(
        "[data-card-artwork-placeholder]",
      )
      if (locked) locked.hidden = false
      if (unlocked) unlocked.hidden = true
      if (state) {
        state.textContent = copy.locked
        state.classList.remove("text-amber-400")
        state.classList.add("text-zinc-400")
      }
      if (line) line.textContent = ""
      if (track) track.textContent = ""
      if (riddle) riddle.textContent = ""
      if (meta) meta.textContent = ""
      if (artwork) {
        artwork.onload = null
        artwork.onerror = null
        artwork.removeAttribute("src")
        artwork.alt = ""
        artwork.hidden = true
      }
      if (artworkPlaceholder) artworkPlaceholder.hidden = false
    })

    claims.forEach((claim) => {
      if (!claim?.dropId || !drops.has(claim.dropId)) return
      claimedDrops.add(claim.dropId)
      latestClaim = {
        dropId: claim.dropId,
        city: claim.city || "",
        citySlug: drops.get(claim.dropId)?.citySlug || "",
        line: claim.line || "",
      }
      const card = root.querySelector<HTMLElement>(
        `[data-collection-card="${CSS.escape(claim.dropId)}"]`,
      )
      if (!card) return
      card.classList.add("is-unlocked")
      const locked = card.querySelector<HTMLElement>("[data-card-locked]")
      const unlocked = card.querySelector<HTMLElement>("[data-card-unlocked]")
      if (locked) locked.hidden = true
      if (unlocked) unlocked.hidden = false
      const line = card.querySelector<HTMLElement>("[data-card-line]")
      const track = card.querySelector<HTMLElement>("[data-card-track]")
      const state = card.querySelector<HTMLElement>("[data-card-state]")
      const meta = card.querySelector<HTMLElement>("[data-card-meta]")
      const riddle = card.querySelector<HTMLElement>("[data-card-riddle]")
      const artwork = card.querySelector<HTMLImageElement>("[data-card-artwork]")
      const artworkPlaceholder = card.querySelector<HTMLElement>(
        "[data-card-artwork-placeholder]",
      )
      if (line) line.textContent = `“${claim.line}”`
      if (track) track.textContent = `${claim.track} · ${claim.edition}`
      if (riddle) {
        riddle.textContent = claim.riddle ? `${copy.riddle}: ${claim.riddle}` : ""
      }
      const artworkPath =
        typeof claim.artwork === "string"
          ? claim.artwork
          : typeof claim.artworkUrl === "string"
            ? claim.artworkUrl
            : ""
      const expectedArtwork = `/area/collectibles/${claim.dropId}.webp`
      if (artwork && artworkPath === expectedArtwork) {
        artwork.alt = `${copy.artworkAlt} — ${claim.city || claim.dropId}`
        artwork.hidden = false
        artwork.onload = () => {
          if (artworkPlaceholder) artworkPlaceholder.hidden = true
        }
        artwork.onerror = () => {
          artwork.removeAttribute("src")
          artwork.hidden = true
          if (artworkPlaceholder) artworkPlaceholder.hidden = false
        }
        artwork.src = artworkPath
      } else if (artworkPlaceholder) {
        artworkPlaceholder.hidden = false
      }
      if (meta) {
        const recoveredAt = new Date(claim.claimedAt)
        const date = Number.isNaN(recoveredAt.getTime())
          ? ""
          : new Intl.DateTimeFormat(lang === "pl" ? "pl-PL" : "en-GB", {
              dateStyle: "medium",
            }).format(recoveredAt)
        const artifact = Number.isInteger(claim.editionNumber)
          ? `${copy.editionNumber} #${String(claim.editionNumber).padStart(3, "0")}`
          : ""
        meta.textContent = [artifact, date ? `${copy.recoveredOn}: ${date}` : ""]
          .filter(Boolean)
          .join(" · ")
      }
      if (state) {
        state.textContent = copy.unlocked
        state.classList.remove("text-zinc-400")
        state.classList.add("text-amber-400")
      }
    })

    const signalClaim = latestClaim as AreaLatestClaim | null
    const signalBridge = root.querySelector<HTMLElement>("[data-signal-bridge]")
    const signalBridgeLink = root.querySelector<HTMLAnchorElement>("[data-signal-bridge-link]")
    if (signalBridge) signalBridge.hidden = !signalClaim
    if (signalClaim?.citySlug && signalBridgeLink) {
      try {
        localStorage.setItem("virya-signal-city", signalClaim.citySlug)
      } catch {
        // Optional personalization must not affect AREA.
      }
      const signalUrl = new URL(root.dataset.signalUrl || "/signal/", location.origin)
      signalUrl.searchParams.set("city", signalClaim.citySlug)
      signalUrl.searchParams.set("source", "area")
      signalUrl.searchParams.set("drop", signalClaim.dropId)
      signalUrl.hash = "join-signal"
      signalBridgeLink.href = signalUrl.toString()
    }

    buttons.forEach((button) => {
      button.classList.toggle("is-claimed", claimedDrops.has(button.dataset.dropId || ""))
    })
    const collectionSize = drops.size
    const recovered = claimedDrops.size
    const count = root.querySelector<HTMLElement>("[data-collection-count]")
    const size = root.querySelector<HTMLElement>("[data-collection-size]")
    const progress = root.querySelector<HTMLElement>("[data-collection-progress]")
    const progressBar = root.querySelector<HTMLElement>("[data-collection-progress-bar]")
    const complete = root.querySelector<HTMLElement>("[data-collection-complete]")
    const completeBody = root.querySelector<HTMLElement>("[data-collection-complete-body]")
    if (count) count.textContent = String(recovered)
    if (size) size.textContent = String(collectionSize)
    if (progress) progress.setAttribute("aria-valuenow", String(recovered))
    if (progressBar) {
      progressBar.style.width = `${collectionSize ? (recovered / collectionSize) * 100 : 0}%`
    }
    const isComplete = collectionSize > 0 && recovered === collectionSize
    if (complete) complete.hidden = !isComplete
    if (completeBody) completeBody.hidden = !isComplete
    renderSelected(selectedId())
    return signalClaim
  }

  const renderVouchers = (vouchers: any[]) => {
    const wrap = root.querySelector<HTMLElement>("[data-voucher-list-wrap]")
    const list = root.querySelector<HTMLElement>("[data-voucher-list]")
    if (!wrap || !list) return
    list.textContent = ""
    wrap.hidden = vouchers.length === 0

    vouchers.forEach((voucher) => {
      const item = document.createElement("li")
      item.className =
        "flex min-w-0 flex-col items-stretch gap-3 border border-zinc-800 bg-zinc-950 p-3 sm:flex-row sm:items-center sm:justify-between"
      const code = document.createElement("code")
      code.className = "break-all text-xs font-bold text-amber-400"
      code.textContent = voucher.code
      const meta = document.createElement("span")
      meta.className = "text-[9px] uppercase tracking-widest text-zinc-400"
      const statusLabel =
        voucher.status === "redeemed"
          ? copy.codeRedeemed
          : voucher.status === "reserved"
            ? copy.codeReserved
            : copy.codeIssued
      meta.textContent = `${copy.codeBenefit} · ${statusLabel}`
      const actions = document.createElement("div")
      actions.className = "flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
      const copyButton = document.createElement("button")
      copyButton.type = "button"
      copyButton.className =
        "min-h-[40px] w-full border border-zinc-700 px-3 text-[9px] font-black uppercase tracking-widest text-zinc-300 hover:border-amber-400 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      copyButton.textContent = copy.copyCode
      copyButton.disabled = voucher.status === "redeemed"
      copyButton.addEventListener("click", async () => {
        await navigator.clipboard.writeText(voucher.code)
        copyButton.textContent = copy.copied
      })
      const storeButton = document.createElement("button")
      storeButton.type = "button"
      storeButton.className =
        "min-h-[40px] w-full bg-amber-400 px-3 text-[9px] font-black uppercase tracking-widest text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      storeButton.textContent = copy.useInStore
      storeButton.disabled = voucher.status === "redeemed"
      storeButton.addEventListener("click", () => {
        try {
          sessionStorage.setItem("virya-area-reward-code", voucher.code)
        } catch {
          // The code remains visible and can still be copied manually.
        }
        location.assign(root.dataset.merchUrl || "/merch/")
      })
      actions.append(copyButton, storeButton)
      const text = document.createElement("div")
      text.className = "flex min-w-0 flex-col gap-1"
      text.append(code, meta)
      item.append(text, actions)
      list.append(item)
    })
  }

  return { renderClaims, renderVouchers }
}
