// Browser runtime for AreaExperience.astro. Keep private coordinates server-side.
type DropInfo = {
  id: string
  city: string
  citySlug: string
  region: string
  number: string
  clue: string
  lat: number
  lng: number
}

type ClientCopy = Record<string, string>
const AREA_REQUEST_TIMEOUT_MS = 10_000

const areaRadians = (value: number) => value * Math.PI / 180
const areaDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const dLat = areaRadians(lat2 - lat1)
  const dLng = areaRadians(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(areaRadians(lat1)) * Math.cos(areaRadians(lat2)) *
    Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const areaPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
  if (!("geolocation" in navigator)) {
    reject(new Error("geolocation unavailable"))
    return
  }
  navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000,
  })
})

const formatAreaDistance = (kilometres: number) => {
  if (kilometres < 1) return `${Math.max(1, Math.round(kilometres * 1000))} m`
  return `${kilometres < 10 ? kilometres.toFixed(1) : Math.round(kilometres)} km`
}

const initAreaExperience = () => {
  document.querySelectorAll<HTMLElement>("[data-area-experience]").forEach((root) => {
    if (root.dataset.ready === "true") return
    root.dataset.ready = "true"

    const copyNode = root.querySelector<HTMLScriptElement>("[data-area-copy]")
    if (!copyNode) return
    const copy = JSON.parse(copyNode.textContent || "{}") as ClientCopy
    const lang = root.dataset.lang || "en"
    const fragmentParams = new URLSearchParams(location.hash.slice(1))
    const authToken = fragmentParams.get("auth")
    if (authToken) {
      history.replaceState(null, "", `${location.pathname}${location.search}`)
    }
    const buttons = Array.from(root.querySelectorAll<HTMLElement>("[data-drop-button]"))
    const drops = new Map<string, DropInfo>()
    const liveDrops = new Set<string>()
    const claimedDrops = new Set<string>()
    let latestClaim: { dropId: string; city: string; citySlug: string; line: string } | null = null
    let isClaiming = false
    let isAuthenticated = false
    let profileResolved = false
    let hasCommunityProgress = false

    buttons.forEach((button) => {
      const id = button.dataset.dropId
      if (!id) return
      const live = button.dataset.live === "true"
      if (live) liveDrops.add(id)
      button.classList.toggle("is-live", live)
      button.classList.toggle("is-inactive", !live)
      button.dataset.signalState = live ? "live" : "inactive"
      if (drops.has(id)) return
      drops.set(id, {
        id,
        city: button.dataset.city || "",
        citySlug: button.dataset.citySlug || "",
        region: button.dataset.region || "",
        number: button.dataset.number || "",
        clue: button.dataset.clue || "",
        lat: Number(button.dataset.lat),
        lng: Number(button.dataset.lng),
      })
    })

    const selectedCity = root.querySelector<HTMLElement>("[data-selected-city]")
    const selectedRegion = root.querySelector<HTMLElement>("[data-selected-region]")
    const selectedNumber = root.querySelector<HTMLElement>("[data-selected-number]")
    const selectedClue = root.querySelector<HTMLElement>("[data-selected-clue]")
    const selectedStatus = root.querySelector<HTMLElement>("[data-selected-status]")
    const selectedCoordinates = root.querySelector<HTMLElement>("[data-selected-coordinates]")
    const navigationButton = root.querySelector<HTMLAnchorElement>("[data-navigation-button]")
    const locationStatus = root.querySelector<HTMLElement>("[data-location-status]")
    const profileShell = root.querySelector<HTMLElement>("[data-profile-shell]")
    const profileLoading = root.querySelector<HTMLElement>("[data-profile-loading]")
    const profileLoggedOut = root.querySelector<HTMLElement>("[data-profile-logged-out]")
    const profileLoggedIn = root.querySelector<HTMLElement>("[data-profile-logged-in]")
    const profileEmail = root.querySelector<HTMLElement>("[data-profile-email]")
    const profileStatus = root.querySelector<HTMLElement>("[data-profile-status]")
    const migrationNotice = root.querySelector<HTMLElement>("[data-migration-notice]")
    const claimButton = root.querySelector<HTMLButtonElement>("[data-claim-button]")
    const claimAuthRequired = root.querySelector<HTMLElement>("[data-claim-auth-required]")
    const claimStatus = root.querySelector<HTMLElement>("[data-claim-status]")
    let selectedId =
      buttons.find(button => button.dataset.live === "true")?.dataset.dropId ||
      buttons[0]?.dataset.dropId ||
      ""

    const sendAreaEvent = (
      event: "page_view" | "share",
      dropId?: string
    ) => {
      const payload: Record<string, string> = {
        event,
        lang,
        path: location.pathname,
      }
      if (dropId && drops.has(dropId)) payload.dropId = dropId
      if (event === "page_view") {
        const sessionKey = `virya-area-page-view:${location.pathname}`
        if (sessionStorage.getItem(sessionKey) === "1") return
        sessionStorage.setItem(sessionKey, "1")
      }
      void fetch("/api/area/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {
        // Telemetry must never block the player experience.
      })
    }

    const syncClaimAccess = () => {
      const live = liveDrops.has(selectedId)
      const claimed = claimedDrops.has(selectedId)
      if (claimButton) {
        claimButton.disabled =
          isClaiming ||
          !profileResolved ||
          !isAuthenticated ||
          !live ||
          claimed
      }
      if (claimAuthRequired) {
        claimAuthRequired.hidden = !profileResolved || isAuthenticated
      }
      if (!claimStatus) return
      if (!profileResolved) {
        claimStatus.textContent = copy.claimAccountChecking
      } else if (!isAuthenticated) {
        claimStatus.textContent = copy.claimAccountRequired
      } else if (!live) {
        claimStatus.textContent = copy.claimInactive
      } else if (claimed) {
        claimStatus.textContent = copy.claimAlready
      } else if (
        claimStatus.textContent === copy.claimAccountChecking ||
        claimStatus.textContent === copy.claimAccountRequired ||
        claimStatus.textContent === copy.claimInactive ||
        claimStatus.textContent === copy.claimAlready
      ) {
        claimStatus.textContent = ""
      }
    }

    const renderCommunity = (data: any) => {
      const community =
        data?.community ??
        data?.communityProgress ??
        data?.stats?.community
      const count = root.querySelector<HTMLElement>("[data-community-count]")
      const totalEl = root.querySelector<HTMLElement>("[data-community-total]")
      const progress = root.querySelector<HTMLElement>("[data-community-progress]")
      const bar = root.querySelector<HTMLElement>("[data-community-progress-bar]")
      const status = root.querySelector<HTMLElement>("[data-community-status]")

      if (!community || typeof community !== "object") {
        if (!hasCommunityProgress && status) {
          status.textContent = copy.communityUnavailable
        }
        return
      }

      const current = Number(
        community.claimed ??
        community.current ??
        community.unlocked ??
        community.count ??
        community.verifiedClaims
      )
      const total = Number(
        community.total ??
        community.goal ??
        community.target ??
        community.collectionSize ??
        drops.size
      )
      if (
        !Number.isFinite(current) ||
        current < 0 ||
        !Number.isFinite(total) ||
        total <= 0
      ) {
        if (!hasCommunityProgress && status) {
          status.textContent = copy.communityUnavailable
        }
        return
      }

      hasCommunityProgress = true
      const boundedCurrent = Math.min(current, total)
      const providedPercent = Number(community.percent)
      const percent = Number.isFinite(providedPercent)
        ? Math.min(100, Math.max(0, providedPercent))
        : Math.min(100, (boundedCurrent / total) * 100)
      const communityPanel = root.querySelector<HTMLElement>("[data-community-panel]")
      if (communityPanel) communityPanel.hidden = boundedCurrent < 10
      if (count) count.textContent = String(Math.round(boundedCurrent))
      if (totalEl) totalEl.textContent = String(Math.round(total))
      if (progress) {
        progress.setAttribute("aria-valuemax", String(total))
        progress.setAttribute("aria-valuenow", String(boundedCurrent))
        progress.setAttribute(
          "aria-valuetext",
          `${Math.round(boundedCurrent)} / ${Math.round(total)}`
        )
      }
      if (bar) bar.style.width = `${percent}%`
      if (status) {
        status.textContent =
          boundedCurrent >= total
            ? copy.communityComplete
            : `${Math.round(boundedCurrent)} / ${Math.round(total)} · ${copy.communityProgress}`
      }
    }

    const renderProfile = (data: any, message = "") => {
      const profile =
        data?.profile && typeof data.profile === "object"
          ? data.profile
          : data?.user && typeof data.user === "object"
          ? data.user
          : null
      const authValue =
        data?.authenticated ??
        data?.loggedIn ??
        profile?.authenticated
      isAuthenticated = Boolean(
        authValue ?? (profile && (profile.emailMasked || profile.email))
      )
      profileResolved = true

      if (profileShell) profileShell.setAttribute("aria-busy", "false")
      if (profileLoading) profileLoading.hidden = true
      if (profileLoggedOut) profileLoggedOut.hidden = isAuthenticated
      if (profileLoggedIn) profileLoggedIn.hidden = !isAuthenticated
      if (profileEmail) {
        profileEmail.textContent =
          profile?.emailMasked ??
          data?.emailMasked ??
          ""
      }
      const migrationRequired = Boolean(
        data?.migrationRequired ??
        data?.migration?.required ??
        profile?.migrationRequired
      )
      if (migrationNotice) {
        migrationNotice.hidden = !migrationRequired
      }
      if (profileStatus) profileStatus.textContent = message
      renderCommunity(data)
      syncClaimAccess()
    }

    const renderSelected = (id: string) => {
      const drop = drops.get(id)
      if (!drop) return
      selectedId = id
      buttons.forEach((button) => {
        const active = button.dataset.dropId === id
        button.classList.toggle("is-selected", active)
        button.setAttribute("aria-pressed", String(active))
      })
      if (selectedCity) selectedCity.textContent = drop.city
      if (selectedRegion) selectedRegion.textContent = drop.region
      if (selectedNumber) selectedNumber.textContent = `#${drop.number}`
      if (selectedClue) selectedClue.textContent = `“${drop.clue}”`

      const isClaimed = claimedDrops.has(id)
      const live = liveDrops.has(id)
      if (selectedStatus) {
        selectedStatus.lastChild!.textContent = isClaimed
          ? ` ${copy.claimed}`
          : live
          ? ` ${copy.live}`
          : ` ${copy.signal}`
      }
      if (selectedCoordinates) {
        selectedCoordinates.textContent = live ? copy.encrypted : copy.signal
      }
      if (navigationButton) {
        navigationButton.hidden = !live
        navigationButton.href = live
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${drop.lat},${drop.lng}`)}`
          : ""
      }
      const panel = root.querySelector<HTMLElement>("[data-claim-panel]")
      if (panel) panel.hidden = !live
      syncClaimAccess()
    }

    buttons.forEach((button) =>
      button.addEventListener("click", () => {
        if (button.dataset.dropId) renderSelected(button.dataset.dropId)
      })
    )

    root.querySelector<HTMLElement>("[data-nearest-button]")?.addEventListener("click", async () => {
      if (liveDrops.size === 0) {
        if (locationStatus) locationStatus.textContent = copy.noLiveSignal
        return
      }
      if (locationStatus) locationStatus.textContent = copy.locationWorking
      try {
        const position = await areaPosition()
        let nearest: { drop: DropInfo; distance: number } | null = null
        for (const drop of drops.values()) {
          if (!liveDrops.has(drop.id)) continue
          const distance = areaDistance(
            position.coords.latitude,
            position.coords.longitude,
            drop.lat,
            drop.lng
          )
          if (!nearest || distance < nearest.distance) nearest = { drop, distance }
        }
        if (!nearest) throw new Error("no drops")
        renderSelected(nearest.drop.id)
        const result = copy.nearestTemplate
          .replace("{city}", nearest.drop.city)
          .replace("{distance}", formatAreaDistance(nearest.distance))
        if (locationStatus) locationStatus.textContent = result
      } catch {
        if (locationStatus) locationStatus.textContent = copy.locationDenied
      }
    })

    const renderClaims = (claims: any[]) => {
      claimedDrops.clear()
      latestClaim = null
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
          "[data-card-artwork-placeholder]"
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
        const card = root.querySelector<HTMLElement>(`[data-collection-card="${CSS.escape(claim.dropId)}"]`)
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
          "[data-card-artwork-placeholder]"
        )
        if (line) line.textContent = `“${claim.line}”`
        if (track) track.textContent = `${claim.track} · ${claim.edition}`
        if (riddle) {
          riddle.textContent = claim.riddle
            ? `${copy.riddle}: ${claim.riddle}`
            : ""
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

      // Claims are assigned inside the iteration callback above. Keep the
      // declared union here instead of TypeScript's callback-insensitive
      // control-flow narrowing, which otherwise treats this value as null.
      const signalClaim = latestClaim as {
        dropId: string
        city: string
        citySlug: string
        line: string
      } | null
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
        button.classList.toggle(
          "is-claimed",
          claimedDrops.has(button.dataset.dropId || "")
        )
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
      renderSelected(selectedId)
    }

    const renderVouchers = (vouchers: any[]) => {
      const wrap = root.querySelector<HTMLElement>("[data-voucher-list-wrap]")
      const list = root.querySelector<HTMLElement>("[data-voucher-list]")
      if (!wrap || !list) return
      list.textContent = ""
      wrap.hidden = vouchers.length === 0

      vouchers.forEach((voucher) => {
        const item = document.createElement("li")
        item.className = "flex min-w-0 flex-col items-stretch gap-3 border border-zinc-800 bg-zinc-950 p-3 sm:flex-row sm:items-center sm:justify-between"
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
        copyButton.className = "min-h-[40px] w-full border border-zinc-700 px-3 text-[9px] font-black uppercase tracking-widest text-zinc-300 hover:border-amber-400 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        copyButton.textContent = copy.copyCode
        copyButton.disabled = voucher.status === "redeemed"
        copyButton.addEventListener("click", async () => {
          await navigator.clipboard.writeText(voucher.code)
          copyButton.textContent = copy.copied
        })
        const storeButton = document.createElement("button")
        storeButton.type = "button"
        storeButton.className = "min-h-[40px] w-full bg-amber-400 px-3 text-[9px] font-black uppercase tracking-widest text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
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

    const renderWallet = (data: any) => {
      const balance = Number(data?.tokenBalance || 0)
      const balanceEl = root.querySelector<HTMLElement>("[data-wallet-balance]")
      const statusEl = root.querySelector<HTMLElement>("[data-wallet-status]")
      if (balanceEl) balanceEl.textContent = String(balance)
      if (statusEl) statusEl.textContent = balance > 0 ? `${balance} ${copy.walletUnit} · ${copy.codeBenefit}` : copy.voucherEmpty

      if (
        data &&
        typeof data === "object" &&
        ("authenticated" in data || "loggedIn" in data || data.profile || data.user)
      ) {
        renderProfile(data)
      } else {
        renderCommunity(data)
      }

      if (Array.isArray(data?.liveDrops)) {
        liveDrops.clear()
        data.liveDrops.forEach((drop: any) => {
          if (typeof drop?.id === "string") liveDrops.add(drop.id)
        })
      }
      buttons.forEach((button) => {
        const live = liveDrops.has(button.dataset.dropId || "")
        button.classList.toggle("is-live", live)
        button.classList.toggle("is-inactive", !live)
        button.dataset.signalState = live ? "live" : "inactive"
      })
      const firstLive = Array.from(liveDrops)[0]
      if (firstLive) {
        renderSelected(firstLive)
        if (locationStatus) locationStatus.textContent = lang === "pl" ? "Wybierz aktywny sygnał albo znajdź najbliższy." : "Choose a live signal or find the nearest one."
      } else {
        const panel = root.querySelector<HTMLElement>("[data-claim-panel]")
        if (panel) panel.hidden = true
        if (navigationButton) navigationButton.hidden = true
        if (locationStatus) locationStatus.textContent = copy.noLiveSignal
      }

      renderClaims(Array.isArray(data?.claims) ? data.claims : [])
      renderVouchers(Array.isArray(data?.vouchers) ? data.vouchers : [])

      const voucherButton = root.querySelector<HTMLButtonElement>("[data-voucher-button]")
      if (voucherButton) {
        voucherButton.disabled = balance < 1 || !isAuthenticated
        voucherButton.textContent = copy.voucherButton
      }
      renderSelected(selectedId)
    }

    const loadWallet = async () => {
      try {
        const response = await fetch("/api/area/wallet", {
          signal: AbortSignal.timeout(AREA_REQUEST_TIMEOUT_MS),
          headers: { Accept: "application/json" },
          cache: "no-store",
        })
        if (!response.ok) throw new Error("wallet unavailable")
        renderWallet(await response.json())
      } catch {
        const status = root.querySelector<HTMLElement>("[data-wallet-status]")
        if (status) status.textContent = copy.voucherError
        renderProfile({ authenticated: false }, copy.profileUnavailable)
      }
    }

    const verifyAuth = async (token: string) => {
      if (profileStatus) profileStatus.textContent = copy.profileVerifying
      try {
        const response = await fetch("/api/area/auth/verify", {
          signal: AbortSignal.timeout(AREA_REQUEST_TIMEOUT_MS),
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ token }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data?.authenticated) {
          throw new Error(copy.profileVerifyError)
        }
        renderProfile(data, copy.profileVerifySuccess)
        await loadWallet()
      } catch (error) {
        renderProfile(
          { authenticated: false },
          error instanceof Error ? error.message : copy.profileVerifyError
        )
        await loadWallet()
      }
    }

    root.querySelector<HTMLFormElement>("[data-auth-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault()
      const form = event.currentTarget as HTMLFormElement
      const email = form.querySelector<HTMLInputElement>("[data-auth-email]")
      const button = form.querySelector<HTMLButtonElement>("[data-auth-request]")
      if (!email || !button) return
      if (!form.checkValidity()) {
        form.reportValidity()
        return
      }

      const idleText = button.textContent || ""
      button.disabled = true
      button.textContent = copy.profileRequestWorking
      if (profileStatus) profileStatus.textContent = copy.profileRequestWorking
      try {
        const response = await fetch("/api/area/auth/request", {
          signal: AbortSignal.timeout(AREA_REQUEST_TIMEOUT_MS),
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            email: email.value.trim(),
            lang,
            returnTo: location.pathname,
          }),
        })
        if (!response.ok) throw new Error(copy.profileRequestError)
        if (profileStatus) profileStatus.textContent = copy.profileRequestSent
        form.reset()
      } catch (error) {
        if (profileStatus) {
          profileStatus.textContent =
            error instanceof Error ? error.message : copy.profileRequestError
        }
      } finally {
        button.disabled = false
        button.textContent = idleText
      }
    })

    root.querySelector<HTMLButtonElement>("[data-auth-logout]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget as HTMLButtonElement
      const idleText = button.textContent || ""
      button.disabled = true
      button.textContent = copy.profileSignOutWorking
      if (profileStatus) profileStatus.textContent = copy.profileSignOutWorking
      try {
        const response = await fetch("/api/area/auth/logout", {
          signal: AbortSignal.timeout(AREA_REQUEST_TIMEOUT_MS),
          method: "POST",
          headers: { Accept: "application/json" },
        })
        if (!response.ok) throw new Error(copy.profileSignOutError)
        renderProfile({ authenticated: false })
        await loadWallet()
      } catch (error) {
        if (profileStatus) {
          profileStatus.textContent =
            error instanceof Error ? error.message : copy.profileSignOutError
        }
      } finally {
        button.disabled = false
        button.textContent = idleText
      }
    })

    root.querySelector<HTMLButtonElement>("[data-claim-button]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget as HTMLButtonElement
      const status = root.querySelector<HTMLElement>("[data-claim-status]")
      if (!profileResolved || !isAuthenticated) {
        if (status) {
          status.textContent = profileResolved
            ? copy.claimAccountRequired
            : copy.claimAccountChecking
        }
        syncClaimAccess()
        return
      }
      if (!liveDrops.has(selectedId)) {
        if (status) status.textContent = copy.claimInactive
        syncClaimAccess()
        return
      }

      isClaiming = true
      syncClaimAccess()
      if (status) status.textContent = copy.claimWorking
      try {
        const challengeResponse = await fetch("/api/area/challenge", {
          signal: AbortSignal.timeout(AREA_REQUEST_TIMEOUT_MS),
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ dropId: selectedId }),
        })
        const challengeData = await challengeResponse.json().catch(() => ({}))
        if (!challengeResponse.ok || !challengeData.challenge) {
          const challengeMessages: Record<string, string> = {
            DROP_INACTIVE: copy.claimInactive,
            AUTH_REQUIRED: copy.claimAccountRequired,
            TEMPORARY: copy.claimGenericError,
          }
          throw new Error(challengeMessages[challengeData.code] || copy.claimGenericError)
        }

        const minSamples = Math.max(3, Number(challengeData.minSamples) || 3)
        const maxSamples = Math.max(minSamples, Math.min(8, Number(challengeData.maxSamples) || 8))
        const minDurationMs = Math.max(6000, Number(challengeData.minDurationMs) || 6000)
        const targetSamples = Math.min(maxSamples, Math.max(minSamples, 4))
        const startedAt = Date.now()
        const samples: Array<{ lat: number; lng: number; accuracy: number; capturedAt: number }> = []

        while (samples.length < targetSamples || Date.now() - startedAt < minDurationMs) {
          if (samples.length >= maxSamples) break
          if (status) {
            status.textContent = copy.claimCollecting
              .replace("{current}", String(Math.min(samples.length + 1, targetSamples)))
              .replace("{total}", String(targetSamples))
          }
          const position = await areaPosition()
          samples.push({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            capturedAt: Date.now(),
          })
          const elapsed = Date.now() - startedAt
          const remainingDuration = Math.max(0, minDurationMs - elapsed)
          const remainingSamples = Math.max(0, targetSamples - samples.length)
          if (remainingDuration > 0 || remainingSamples > 0) {
            await new Promise((resolve) => setTimeout(resolve, Math.min(2100, Math.max(650, remainingDuration))))
          }
        }

        const response = await fetch("/api/area/claim", {
          signal: AbortSignal.timeout(AREA_REQUEST_TIMEOUT_MS),
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            dropId: selectedId,
            challenge: challengeData.challenge,
            samples,
          }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          const messages: Record<string, string> = {
            DROP_INACTIVE: copy.claimInactive,
            CHALLENGE_INVALID: copy.claimInvalidCode,
            NOT_ENOUGH_SAMPLES: copy.claimSamples,
            LOW_ACCURACY: copy.claimAccuracy,
            OUTSIDE_ZONE: copy.claimOutside,
            DROP_FULL: copy.claimFull,
            CLAIM_CONFLICT: copy.claimAlready,
            RATE_LIMITED: copy.claimRateLimited,
            AUTH_REQUIRED: copy.claimAccountRequired,
            UNAUTHORIZED: copy.claimAccountRequired,
            ACCOUNT_REQUIRED: copy.claimAccountRequired,
          }
          if (["AUTH_REQUIRED", "UNAUTHORIZED", "ACCOUNT_REQUIRED"].includes(data.code)) {
            renderProfile({ authenticated: false })
          }
          throw new Error(messages[data.code] || copy.claimGenericError)
        }
        if (status) status.textContent = data.alreadyClaimed ? copy.claimAlready : copy.claimSuccess
        await loadWallet()
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : copy.claimGenericError
      } finally {
        isClaiming = false
        syncClaimAccess()
      }
    })

    root.querySelector<HTMLButtonElement>("[data-voucher-button]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget as HTMLButtonElement
      const status = root.querySelector<HTMLElement>("[data-voucher-status]")
      const tokens = 1
      const voucherRequestKey = "virya-area-voucher-request"
      button.disabled = true
      button.textContent = copy.voucherWorking
      if (status) status.textContent = copy.voucherWorking
      try {
        const requestId =
          sessionStorage.getItem(voucherRequestKey) || crypto.randomUUID()
        sessionStorage.setItem(voucherRequestKey, requestId)
        const response = await fetch("/api/area/voucher", {
          signal: AbortSignal.timeout(AREA_REQUEST_TIMEOUT_MS),
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ tokens, requestId }),
        })
        const data = await response.json()
        if (!response.ok) {
          if (data.retryWithNewRequest) {
            sessionStorage.removeItem(voucherRequestKey)
          }
          throw new Error(
            data.code === "VOUCHER_PENDING"
              ? copy.voucherWorking
              : copy.voucherError
          )
        }
        sessionStorage.removeItem(voucherRequestKey)
        if (status) status.textContent = copy.voucherSuccess
        await loadWallet()
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : copy.voucherError
      } finally {
        button.textContent = copy.voucherButton
        const balance = Number(root.querySelector<HTMLElement>("[data-wallet-balance]")?.textContent || 0)
        button.disabled = balance < 1 || !isAuthenticated
      }
    })

    root.querySelector<HTMLButtonElement>("[data-share-button]")?.addEventListener("click", async () => {
      const status = root.querySelector<HTMLElement>("[data-share-status]")
      const text = latestClaim
        ? copy.shareClaimedTemplate
            .replace("{city}", latestClaim.city)
            .replace("{line}", latestClaim.line)
        : copy.shareGeneric
      const url = new URL(`/${lang === "pl" ? "pl/" : ""}area/`, location.origin)
      url.searchParams.set("utm_source", "share")
      url.searchParams.set("utm_medium", "social")
      url.searchParams.set("utm_campaign", "virya_area")
      try {
        if (navigator.share) {
          await navigator.share({ title: copy.shareTitle, text, url: url.toString() })
        } else {
          await navigator.clipboard.writeText(`${text}\n${url}`)
          if (status) status.textContent = copy.shareCopied
        }
        sendAreaEvent("share", latestClaim?.dropId)
      } catch {
        // User cancellation is not an error worth surfacing.
      }
    })

    renderSelected(selectedId)
    syncClaimAccess()
    sendAreaEvent("page_view")
    if (authToken && authToken.length <= 2048) {
      void verifyAuth(authToken)
    } else {
      if (authToken && profileStatus) {
        profileStatus.textContent = copy.profileVerifyError
      }
      void loadWallet()
    }
  })
}

document.addEventListener("astro:page-load", initAreaExperience)
