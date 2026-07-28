const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function createDialogFocus(dialog: HTMLElement) {
  let trigger: HTMLElement | null = null

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return
    const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (item) => item.offsetParent !== null,
    )
    if (items.length === 0) {
      event.preventDefault()
      dialog.focus()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return {
    activate(from?: HTMLElement | null) {
      trigger = from || (document.activeElement instanceof HTMLElement ? document.activeElement : null)
      dialog.addEventListener("keydown", onKeyDown)
      requestAnimationFrame(() => {
        const target = dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]") ||
          dialog.querySelector<HTMLElement>(FOCUSABLE)
        ;(target || dialog).focus()
      })
    },
    deactivate() {
      dialog.removeEventListener("keydown", onKeyDown)
      if (trigger?.isConnected) trigger.focus()
      trigger = null
    },
  }
}
