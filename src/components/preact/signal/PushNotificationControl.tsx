import { useEffect, useState } from "preact/hooks"
import type { Lang } from "../../../i18n/t"
import type { PushConfig } from "../../../lib/crowdrelay-client"
import { crowdrelay } from "../../../lib/crowdrelay"

const INSTALLATION_KEY = "virya-push-installation-v1"

type PushState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "blocked" }
  | { kind: "off"; config: PushConfig }
  | { kind: "on"; config: PushConfig }
  | { kind: "busy"; config: PushConfig; enabling: boolean }
  | { kind: "error"; config: PushConfig; enabledLocally: boolean; retry: "enable" | "disable" }

export default function PushNotificationControl({ lang }: { lang: Lang }) {
  const [state, setState] = useState<PushState>({ kind: "loading" })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!supportsWebPush()) {
        if (!cancelled) setState({ kind: "unavailable" })
        return
      }
      try {
        const config = await crowdrelay.getPushConfig()
        if (cancelled) return
        if (!config.enabled || !config.web_push || !config.vapid_public_key) {
          setState({ kind: "unavailable" })
          return
        }
        if (Notification.permission === "denied") {
          setState({ kind: "blocked" })
          return
        }
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (cancelled) return
        setState(subscription ? { kind: "on", config } : { kind: "off", config })
      } catch {
        if (!cancelled) setState({ kind: "unavailable" })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const enable = async (config: PushConfig) => {
    setState({ kind: "busy", config, enabling: true })
    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? { kind: "blocked" } : { kind: "off", config })
        return
      }
      const publicKey = config.vapid_public_key
      if (!publicKey) throw new Error("missing VAPID key")
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeUrlBase64(publicKey),
        }))
      const json = subscription.toJSON()
      const p256dh = json.keys?.p256dh
      const auth = json.keys?.auth
      if (!subscription.endpoint || !p256dh || !auth) {
        throw new Error("incomplete PushSubscription")
      }
      await crowdrelay.registerPushEndpoint({
        installation_id: installationId(),
        transport: "web_push",
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      })
      setState({ kind: "on", config })
    } catch {
      setState({ kind: "error", config, enabledLocally: true, retry: "enable" })
    }
  }

  const disable = async (config: PushConfig) => {
    setState({ kind: "busy", config, enabling: false })
    let localDisabled = false
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) localDisabled = await subscription.unsubscribe()
      else localDisabled = true
      await crowdrelay.disablePushEndpoint(installationId(), "web_push")
      setState({ kind: "off", config })
    } catch {
      setState({ kind: "error", config, enabledLocally: !localDisabled, retry: "disable" })
    }
  }

  if (state.kind === "loading") {
    return <p class="mt-3 text-xs text-zinc-500">{lang === "pl" ? "Sprawdzam powiadomienia…" : "Checking notifications…"}</p>
  }
  if (state.kind === "unavailable") {
    return (
      <p class="mt-3 text-xs leading-relaxed text-zinc-500">
        {lang === "pl"
          ? "Powiadomienia push nie są jeszcze dostępne na tym urządzeniu lub rollout jest wyłączony."
          : "Push notifications are not available on this device yet, or rollout is disabled."}
      </p>
    )
  }
  if (state.kind === "blocked") {
    return (
      <p class="mt-3 text-xs leading-relaxed text-amber-300">
        {lang === "pl"
          ? "Powiadomienia są zablokowane w ustawieniach przeglądarki. Zmień zgodę dla virya.music, jeśli chcesz je włączyć."
          : "Notifications are blocked in browser settings. Allow them for virya.music to enable push."}
      </p>
    )
  }

  const config = state.config
  const isOn = state.kind === "on" || (state.kind === "error" && state.enabledLocally)
  const mutate = state.kind === "error"
    ? state.retry === "enable" ? enable : disable
    : isOn ? disable : enable
  return (
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        class={`virya-button min-h-[44px] px-4 ${isOn ? "virya-button--secondary" : "virya-button--primary"}`}
        disabled={state.kind === "busy"}
        onClick={() => void mutate(config)}
      >
        {state.kind === "busy"
          ? lang === "pl"
            ? "ZAPISUJĘ…"
            : "SAVING…"
          : state.kind === "error"
            ? lang === "pl"
              ? "PONÓW SYNCHRONIZACJĘ"
              : "RETRY SYNC"
            : isOn
            ? lang === "pl"
              ? "WYŁĄCZ POWIADOMIENIA"
              : "TURN OFF NOTIFICATIONS"
            : lang === "pl"
              ? "WŁĄCZ POWIADOMIENIA"
              : "ENABLE NOTIFICATIONS"}
      </button>
      <span class={`text-[10px] font-bold uppercase tracking-wider ${isOn ? "text-emerald-300" : "text-zinc-500"}`}>
        {isOn ? (lang === "pl" ? "PUSH AKTYWNY" : "PUSH ACTIVE") : lang === "pl" ? "PUSH WYŁĄCZONY" : "PUSH OFF"}
      </span>
      {state.kind === "error" && (
        <p class="w-full text-xs leading-relaxed text-amber-300">
          {lang === "pl"
            ? "Stan urządzenia zmienił się, ale synchronizacja z Signal nie została potwierdzona. Ponów tę samą akcję po odzyskaniu sieci."
            : "The device state changed, but Signal could not confirm the sync. Retry the same action when connectivity returns."}
        </p>
      )}
    </div>
  )
}

function supportsWebPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

function installationId(): string {
  try {
    const existing = localStorage.getItem(INSTALLATION_KEY)
    if (existing && /^[A-Za-z0-9._:-]{8,160}$/.test(existing)) return existing
    const id = `web-${crypto.randomUUID()}`
    localStorage.setItem(INSTALLATION_KEY, id)
    return id
  } catch {
    return `web-${crypto.randomUUID()}`
  }
}

function decodeUrlBase64(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes.buffer
}
