import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("staff routine surfaces stay flat and on the shared radius", () => {
  const login = read("src/components/preact/staff/AdminConsoleUi.tsx")
  const overview = read("src/components/preact/staff/AdminConsoleTabs.tsx")
  const controls = [
    "src/components/preact/staff/BookingPolicyPanel.tsx",
    "src/components/preact/staff/AdminTicketingTab.tsx",
    "src/components/preact/staff/StaffLatarnikNetworkManager.tsx",
  ].map(read).join("\n")

  assert.doesNotMatch(login, /shadow-2xl/)
  assert.doesNotMatch(overview, /radial-gradient/)
  assert.doesNotMatch(controls, /rounded-xl/)
})

test("Signal utility states do not grow decorative glow back", () => {
  for (const path of [
    "src/components/preact/signal/SignalTokenAction.tsx",
    "src/components/preact/signal/MySignal.tsx",
  ]) {
    const source = read(path)
    assert.doesNotMatch(source, /blur-3xl/)
    assert.doesNotMatch(source, /font-black uppercase leading-tight/)
  }
})

test("staff mobile navigation uses one quiet icon grammar", () => {
  const shell = read("src/components/StaffShell.astro")
  assert.equal((shell.match(/data-staff-icon/g) ?? []).length, 5)
  assert.doesNotMatch(shell, /<span aria-hidden="true">(?:●|⌁|◎|◇|•••)<\/span>/)
  assert.doesNotMatch(shell, /text-\[10px\] font-black uppercase tracking-\[\.08em\]/)
})

test("remaining public utility surfaces stay on the restrained grammar", () => {
  const hub = read("src/components/preact/signal/SignalHub.tsx")
  const wallet = read("src/components/preact/tickets/TicketWallet.tsx")
  const proof = read("src/pages/pl/dowody/losowania/[slug].astro")

  assert.doesNotMatch(hub, /virya-panel[^"\n]*shadow-2xl/)
  assert.doesNotMatch(wallet, /rounded-xl/)
  assert.doesNotMatch(wallet, /<h3 class="[^"]*uppercase[^"]*">\{copy\.signalCardTitle\}<\/h3>/)
  assert.doesNotMatch(proof, /rounded-(?:2xl|3xl)/)
})
