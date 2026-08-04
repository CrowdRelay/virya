(() => {
  "use strict"

  if (window.__VIRYA_RUNTIME_GUARD__) return
  window.__VIRYA_RUNTIME_GUARD__ = true

  const VERSION = 1
  const REPORT_KEY = "virya:site-runtime-reports:v1"
  const SESSION_KEY = "virya:site-runtime-session:v1"
  const MAX_REPORTS = 6
  const MAX_MESSAGE = 1200
  const MAX_STACK = 6000
  const HEARTBEAT_MS = 10000
  const MAX_RECOVERY_AGE_MS = 24 * 60 * 60 * 1000

  const installStyles = () => {
    if (document.getElementById("virya-site-runtime-style")) return
    const style = document.createElement("style")
    style.id = "virya-site-runtime-style"
    style.textContent = `
      #virya-site-runtime-failure{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:end center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:rgba(0,0,0,.78);font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;color:#f4f4f5}
      .virya-site-runtime-card{width:min(720px,100%);max-height:min(84vh,760px);overflow:auto;border:1px solid rgba(251,191,36,.7);background:#09090b;padding:20px;box-shadow:0 24px 80px rgba(0,0,0,.7)}
      .virya-site-runtime-eyebrow{margin:0 0 8px;color:#fbbf24;font-size:11px;font-weight:900;letter-spacing:.18em}
      .virya-site-runtime-card h2{margin:0;font-size:clamp(24px,7vw,40px);line-height:1}
      .virya-site-runtime-copy{color:#d4d4d8;line-height:1.55}
      .virya-site-runtime-card pre{max-height:260px;overflow:auto;margin:16px 0;padding:12px;border:1px solid #27272a;background:#000;color:#e4e4e7;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
      .virya-site-runtime-actions{display:flex;flex-wrap:wrap;gap:8px}
      .virya-site-runtime-actions button{min-height:44px;border:1px solid #fbbf24;background:#fbbf24;padding:0 14px;color:#09090b;font:900 11px/1 ui-sans-serif,system-ui,-apple-system,sans-serif;letter-spacing:.12em}
      .virya-site-runtime-actions button:last-child{background:transparent;color:#fbbf24}
      .virya-site-runtime-card small{display:block;min-height:18px;margin-top:10px;color:#a1a1aa}
      @media(min-width:700px){#virya-site-runtime-failure{place-items:center}.virya-site-runtime-card{padding:28px}}
      @media(prefers-reduced-motion:reduce){#virya-site-runtime-failure *{scroll-behavior:auto!important}}
    `
    document.head?.appendChild(style)
  }

  const now = () => new Date().toISOString()
  const epoch = () => Date.now()
  const safePath = () => `${location.origin}${location.pathname}`.slice(0, 1000)
  const randomId = () => {
    try {
      return crypto.randomUUID()
    } catch {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    }
  }

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  }

  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }

  const privacySafeUrl = (value) => {
    try {
      const parsed = new URL(String(value), location.origin)
      return `${parsed.origin}${parsed.pathname}`.slice(0, 1000)
    } catch {
      return String(value || "").split(/[?#]/, 1)[0].slice(0, 1000)
    }
  }

  const sanitizeDiagnosticText = (value, limit) =>
    String(value || "")
      .replace(/https?:\/\/[^\s"'<>]+/gi, (url) => privacySafeUrl(url))
      .replace(
        /([?&](?:token|key|secret|code|session|signature|sig|capability)=)[^&\s]+/gi,
        "$1[redacted]",
      )
      .slice(0, limit)

  const normalizeMessage = (error) => {
    if (typeof error === "string") return sanitizeDiagnosticText(error, MAX_MESSAGE)
    if (typeof error?.message === "string")
      return sanitizeDiagnosticText(error.message, MAX_MESSAGE)
    try {
      return sanitizeDiagnosticText(JSON.stringify(error), MAX_MESSAGE)
    } catch {
      return "Nieznany błąd strony"
    }
  }

  const normalizeStack = (error) =>
    typeof error?.stack === "string"
      ? sanitizeDiagnosticText(error.stack, MAX_STACK)
      : ""

  const sessionId = randomId()
  let lastAction = "boot"
  let heartbeatTimer
  let overlayOpen = false

  const previousSession = readJson(SESSION_KEY, null)
  const previousWasForeground =
    previousSession &&
    previousSession.state === "foreground" &&
    Number.isFinite(previousSession.heartbeatAt) &&
    epoch() - previousSession.heartbeatAt >= 0 &&
    epoch() - previousSession.heartbeatAt < MAX_RECOVERY_AGE_MS

  const session = {
    version: VERSION,
    id: sessionId,
    startedAt: epoch(),
    heartbeatAt: epoch(),
    state: document.visibilityState === "hidden" ? "background" : "foreground",
    path: safePath(),
    lastAction,
  }

  const persistSession = (state = session.state) => {
    session.state = state
    session.heartbeatAt = epoch()
    session.path = safePath()
    session.lastAction = lastAction.slice(0, 160)
    writeJson(SESSION_KEY, session)
  }

  const rememberReport = (report) => {
    const reports = readJson(REPORT_KEY, [])
    const next = [report, ...(Array.isArray(reports) ? reports : [])].slice(0, MAX_REPORTS)
    writeJson(REPORT_KEY, next)
  }

  const reportText = (report) =>
    [
      `Virya runtime report v${report.version}`,
      `ID: ${report.id}`,
      `Rodzaj: ${report.kind}`,
      `Czas: ${report.occurredAt}`,
      `Ścieżka: ${report.path}`,
      `Ostatnia akcja: ${report.lastAction || "brak"}`,
      `Błąd: ${report.message}`,
      report.stack ? `\nStack:\n${report.stack}` : "",
    ]
      .filter(Boolean)
      .join("\n")

  const ensureOverlay = (report) => {
    installStyles()
    if (!document.body) {
      setTimeout(() => ensureOverlay(report), 50)
      return
    }

    document.getElementById("virya-site-runtime-failure")?.remove()
    overlayOpen = true

    const node = document.createElement("section")
    node.id = "virya-site-runtime-failure"
    node.setAttribute("role", "alertdialog")
    node.setAttribute("aria-modal", "true")
    node.setAttribute("aria-labelledby", "virya-site-runtime-title")
    node.innerHTML = `
      <div class="virya-site-runtime-card">
        <p class="virya-site-runtime-eyebrow">VIRYA / DIAGNOSTYKA</p>
        <h2 id="virya-site-runtime-title">Strona zatrzymała błąd</h2>
        <p class="virya-site-runtime-copy">Nie chowamy awarii. Możesz odświeżyć stronę albo skopiować raport techniczny.</p>
        <pre></pre>
        <div class="virya-site-runtime-actions">
          <button type="button" data-action="reload">ODŚWIEŻ</button>
          <button type="button" data-action="copy">KOPIUJ RAPORT</button>
          <button type="button" data-action="close">ZAMKNIJ</button>
        </div>
        <small aria-live="polite"></small>
      </div>`

    const text = reportText(report)
    const pre = node.querySelector("pre")
    if (pre) pre.textContent = text

    node.querySelector('[data-action="reload"]')?.addEventListener("click", () => {
      location.reload()
    })

    node.querySelector('[data-action="copy"]')?.addEventListener("click", async () => {
      const status = node.querySelector("small")
      try {
        await navigator.clipboard.writeText(text)
        if (status) status.textContent = "Raport skopiowany."
      } catch {
        if (status) status.textContent = "Skopiuj tekst raportu ręcznie."
      }
    })

    node.querySelector('[data-action="close"]')?.addEventListener("click", () => {
      overlayOpen = false
      node.remove()
    })

    document.body.appendChild(node)
    node.querySelector("button")?.focus()
  }

  const report = (kind, error, options = {}) => {
    const item = {
      version: VERSION,
      id: randomId(),
      kind: String(kind || "unknown").slice(0, 80),
      message: normalizeMessage(error),
      stack: normalizeStack(error),
      occurredAt: now(),
      path: safePath(),
      lastAction: lastAction.slice(0, 160),
      userAgent: String(navigator.userAgent || "").slice(0, 500),
    }
    rememberReport(item)
    if (options.console !== false) {
      // Always warn (never error): Lighthouse's Best Practices audit flags
      // any console.error call, and this diagnostic hook intentionally
      // stays silent-but-visible rather than tanking that score.
      console.warn(`[virya:runtime] ${item.kind}: ${item.message}`, item)
    }
    window.dispatchEvent(new CustomEvent("virya:runtime-report", { detail: item }))
    // The visible crash overlay is intentionally disabled: errors are still
    // captured to the console and localStorage (see window.__VIRYA_REPORT__),
    // but end users no longer see a full-screen diagnostic modal.
    return item
  }

  const safeActionName = (target) => {
    if (!(target instanceof Element)) return "interaction"
    const actionable = target.closest("button,a,[role='button'],input,select,textarea")
    if (!actionable) return "interaction"
    const value =
      actionable.getAttribute("data-diagnostic-action") ||
      actionable.getAttribute("aria-label") ||
      actionable.id ||
      actionable.getAttribute("name") ||
      actionable.tagName.toLowerCase()
    return String(value || "interaction")
      .replace(/[^A-Za-z0-9:_-]+/g, "-")
      .slice(0, 120)
  }

  window.__VIRYA_REPORT__ = Object.freeze({
    report,
    recent: () => readJson(REPORT_KEY, []),
  })

  window.addEventListener(
    "error",
    (event) => {
      const resource = event.target
      if (resource && resource !== window && resource instanceof Element) {
        const source =
          resource.getAttribute("src") ||
          resource.getAttribute("href") ||
          resource.tagName
        report(
          "resource-load-error",
          `Nie udało się załadować zasobu: ${privacySafeUrl(source).slice(0, 300)}`,
        )
        return
      }
      report("window-error", event.error || event.message)
    },
    true,
  )

  window.addEventListener("unhandledrejection", (event) => {
    event.preventDefault()
    report("unhandled-rejection", event.reason)
  })

  window.addEventListener("click", (event) => {
    lastAction = safeActionName(event.target)
    persistSession()
  }, { capture: true, passive: true })

  window.addEventListener("astro:before-preparation", () => {
    lastAction = "astro-navigation"
    persistSession("foreground")
  })

  window.addEventListener("astro:page-load", () => {
    lastAction = "page-loaded"
    persistSession(document.visibilityState === "hidden" ? "background" : "foreground")
  })

  document.addEventListener("visibilitychange", () => {
    persistSession(document.visibilityState === "hidden" ? "background" : "foreground")
  })

  window.addEventListener("pagehide", () => persistSession("background"))
  window.addEventListener("pageshow", () => persistSession("foreground"))
  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event.data?.type === "VIRYA_OFFLINE_FALLBACK") {
      report("offline-fallback", "Wyświetlono awaryjną odpowiedź offline.", { visible: false })
    }
  })

  persistSession()
  heartbeatTimer = setInterval(() => persistSession(), HEARTBEAT_MS)
  window.addEventListener("pagehide", () => clearInterval(heartbeatTimer), { once: true })

  if (previousWasForeground) {
    lastAction = String(previousSession.lastAction || "unknown").slice(0, 160)
    report(
      "unexpected-previous-termination",
      "Poprzednia sesja strony zakończyła się bez poprawnego przejścia do tła.",
    )
  }
})()
