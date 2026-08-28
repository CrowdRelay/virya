import { createAreaCollectionRenderer, type AreaLatestClaim } from "./areaCollectionRenderer"

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

const AREA_NEAREST_CACHE_MS = 120_000
let areaWarmPosition: GeolocationPosition | null = null
let areaWarmupScheduled = false

const areaPositionWithOptions = (options: PositionOptions) =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("geolocation unavailable"))
      return
    }
    navigator.geolocation.getCurrentPosition((position) => {
      areaWarmPosition = position
      resolve(position)
    }, reject, options)
  })

const areaPrecisePosition = () => areaPositionWithOptions({
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10_000,
})

const areaNearestPosition = () => {
  const cached = areaWarmPosition
  if (cached && Date.now() - cached.timestamp <= AREA_NEAREST_CACHE_MS) {
    return Promise.resolve(cached)
  }
  return areaPositionWithOptions({
    enableHighAccuracy: false,
    maximumAge: AREA_NEAREST_CACHE_MS,
    timeout: 5_000,
  })
}

const scheduleAreaLocationWarmup = () => {
  if (areaWarmupScheduled || !("geolocation" in navigator)) return
  areaWarmupScheduled = true
  const warm = async () => {
    try {
      // Never trigger the browser permission prompt just for warmup. The first
      // explicit user action remains the permission boundary.
      if (!navigator.permissions?.query) return
      const permission = await navigator.permissions.query({ name: "geolocation" as PermissionName })
      if (permission.state !== "granted") return
      await areaNearestPosition()
    } catch {
      // Warmup is best-effort; the explicit nearest/claim actions own UX errors.
    }
  }
  const requestIdle = Reflect.get(window, "requestIdleCallback") as
    | ((callback: IdleRequestCallback, options?: IdleRequestOptions) => number)
    | undefined
  if (typeof requestIdle === "function") {
    requestIdle(() => void warm(), { timeout: 1_500 })
  } else {
    globalThis.setTimeout(() => void warm(), 250)
  }
}

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
    let latestClaim: AreaLatestClaim | null = null
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

    // Warm the provider only when AREA actually has an active signal. This keeps
    // idle visits completely GPS-free while still making the first explicit
    // nearest-point lookup feel warm when permission was already granted.
    if (liveDrops.size > 0) scheduleAreaLocationWarmup()

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
    const claimAuthText = root.querySelector<HTMLElement>("[data-claim-auth-text]")
    const claimAuthLink = root.querySelector<HTMLElement>("[data-claim-auth-link]")
    const claimInlineForm = root.querySelector<HTMLFormElement>("[data-claim-inline-signup]")
    const claimInlineEmail = root.querySelector<HTMLInputElement>("[data-claim-inline-email]")
    const claimInlineButton = root.querySelector<HTMLButtonElement>("[data-claim-inline-button]")
    const claimInlineStatus = root.querySelector<HTMLElement>("[data-claim-inline-status]")
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
        const showAuth = !profileResolved || isAuthenticated
        claimAuthRequired.hidden = showAuth
        // When auth is required (not authenticated), show the inline signup form
        // and hide the plain text + link. When authenticated, hide the form.
        if (!showAuth) {
          if (claimAuthText) claimAuthText.hidden = true
          if (claimAuthLink) claimAuthLink.hidden = true
          if (claimInlineForm) claimInlineForm.classList.remove("hidden")
        } else {
          if (claimAuthText) claimAuthText.hidden = false
          if (claimAuthLink) claimAuthLink.hidden = false
          if (claimInlineForm) claimInlineForm.classList.add("hidden")
        }
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

    // Inline Signal signup from the AREA claim panel — when an
    // unauthenticated player tries to claim, they can enter their email
    // right here instead of navigating to a separate page.
    if (claimInlineForm) {
      claimInlineForm.addEventListener("submit", async (event) => {
        event.preventDefault()
        const email = claimInlineEmail?.value.trim()
        if (!email) return
        if (claimInlineButton) claimInlineButton.disabled = true
        if (claimInlineStatus) {
          claimInlineStatus.classList.remove("hidden")
          claimInlineStatus.textContent = copy.claimInlineSending
        }
        try {
          const response = await fetch("/api/signal-preregister", {
            method: "POST",
            signal: AbortSignal.timeout(12_000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, locale: lang }),
          })
          if (!response.ok) throw new Error("preregister failed")
          if (claimInlineStatus) {
            claimInlineStatus.textContent = copy.claimInlineSent
          }
          if (claimInlineForm) {
            // Disable the form after successful submit
            const input = claimInlineForm.querySelector("input")
            if (input) input.disabled = true
          }
        } catch {
          if (claimInlineStatus) {
            claimInlineStatus.textContent = copy.claimInlineError
          }
          if (claimInlineButton) claimInlineButton.disabled = false
        }
      })
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
        const position = await areaNearestPosition()
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

    const { renderClaims, renderVouchers } = createAreaCollectionRenderer({
      root,
      copy,
      drops,
      claimedDrops,
      buttons,
      lang,
      renderSelected,
      selectedId: () => selectedId,
    })

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

      latestClaim = renderClaims(Array.isArray(data?.claims) ? data.claims : [])
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
          const position = await areaPrecisePosition()
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
