import { crowdrelay } from "./crowdrelay"

// The same key PushNotificationControl uses: a browser is one Signal
// installation whether it opens the web surface, enables push, or both, so
// all three calls — record, link, push registration — name the same id and
// the funnel reads one row per browser instead of one per feature.
const INSTALLATION_KEY = "virya-push-installation-v1"

function installationId(): string {
  const existing = localStorage.getItem(INSTALLATION_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  try {
    localStorage.setItem(INSTALLATION_KEY, id)
  } catch {
    // Storage-denied browsers still get a session-scoped id; the funnel row
    // for them never survives the tab, which is the honest count anyway.
  }
  return id
}

/**
 * Records that this browser opened web Signal — the anonymous half of the
 * install funnel. Fire-and-forget: a failed count must never block or
 * surface in the UI, and the next open retries the upsert anyway.
 */
export function recordWebSignalInstall(): void {
  void crowdrelay
    .recordSignalInstallation({
      installation_id: installationId(),
      platform: "web",
    })
    .catch(() => {})
}

/**
 * Names the fan behind this install. Only for callers that already hold a
 * live fan session — the endpoint answers 401 without one — so the fan_id
 * on the row always came from the session cookie, never from the caller.
 */
export function linkWebSignalInstall(): void {
  void crowdrelay
    .linkSignalInstallation({
      installation_id: installationId(),
      platform: "web",
    })
    .catch(() => {})
}
