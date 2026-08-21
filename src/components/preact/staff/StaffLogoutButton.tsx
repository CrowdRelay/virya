import { useState } from "preact/hooks"
import { staffApi } from "./staffApi"
import { staffLogoutButton } from "./staffButtons"

// Every staff surface shares one session cookie, so every staff surface needs
// the same way out of it. One button instead of a per-panel copy.
export default function StaffLogoutButton({ disabled = false }: { disabled?: boolean }) {
  const [busy, setBusy] = useState(false)
  async function signOut() {
    if (busy) return
    setBusy(true)
    try {
      await staffApi("/api/staff/qr/logout", { method: "POST", body: {} })
    } catch {
      // The cookie is cleared server-side or it never existed. Either way the
      // operator asked to leave, so land them on the login screen.
    }
    window.location.assign("/staff/")
  }
  return (
    <button type="button" disabled={disabled || busy} onClick={() => void signOut()} class={staffLogoutButton}>
      {busy ? "Wylogowuję…" : "Wyloguj"}
    </button>
  )
}
