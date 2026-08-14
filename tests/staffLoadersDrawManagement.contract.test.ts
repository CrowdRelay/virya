import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("standalone staff tabs use the same scoped backend loader as Control Center", () => {
  const qr = read("src/components/preact/staff/ConcertQrManager.tsx")
  const accounting = read("src/components/preact/staff/AccountingManager.tsx")
  const commerce = read("src/components/preact/staff/StaffCommerceManager.tsx")
  const loader = read("src/components/preact/staff/BackendLoader.tsx")

  for (const [source, label] of [
    [qr, "Pobieram koncerty, kampanie QR i bramkę"],
    [accounting, "Pobieram sprzedaż, Stripe i księgowość"],
    [commerce, "Pobieram merch, magazyn i losowania"],
  ] as const) {
    assert.match(source, /BackendLoader/)
    assert.ok(source.includes(label), `missing loader label: ${label}`)
    assert.match(source, /overlay/)
  }
  assert.match(loader, /animate-spin/)
})

test("staff commerce manages every draw and only exposes fail-closed deletion", () => {
  const panel = read("src/components/preact/staff/StaffCommerceManager.tsx")
  const overview = read("src/pages/api/staff/commerce/overview.ts")
  const deletion = read("src/pages/api/staff/commerce/draws/[id]/delete.ts")

  assert.match(overview, /admin\/reward-draws/)
  assert.match(panel, /Wszystkie weighted draws/)
  assert.match(panel, /USUŃ BŁĘDNE LOSOWANIE/)
  assert.match(panel, /draw\.can_delete/)
  assert.match(panel, /run_count/)
  assert.match(panel, /proof_count/)
  assert.match(panel, /Koncert nie jest usuwany/)
  assert.match(panel, /IDŹ DO LOSOWANIA/)
  assert.match(panel, /\/pl\/dowody\/losowania\//)
  assert.match(panel, /encodeURIComponent\(draw\.slug\)/)
  assert.match(deletion, /isSameOriginRequest/)
  assert.match(deletion, /hasStaffQrSession/)
  assert.ok(deletion.includes("admin/reward-draws/${encodeURIComponent(id)}/delete"))
})

test("public draw page explains Proof of Fair before technical details", () => {
  const page = read("src/pages/pl/dowody/losowania/[slug].astro")
  assert.match(page, /VIRYA \/\/ PROOF OF FAIR/)
  assert.match(page, /Każde losowanie w Virya może zostać niezależnie zweryfikowane/)
  assert.match(page, /nie musisz nam wierzyć na słowo/)
  assert.match(page, /Dane techniczne dowodu/)
  const intro = page.split("VIRYA // PROOF OF FAIR", 2)[1]?.split("state.kind === \"not_found\"", 1)[0] ?? ""
  assert.doesNotMatch(intro, /PostgreSQL pozostaje źródłem prawdy/)
  assert.doesNotMatch(intro, /snapshoty kandydatów/)
  assert.doesNotMatch(page, /Draw slug:/)
})

test("public proof lifecycle is sourced from CrowdRelay and removed draws become real 404s", () => {
  const page = read("src/pages/pl/dowody/losowania/[slug].astro")
  const lifecycle = read("src/server/publicDrawProof.ts")
  const statusProxy = read("src/pages/api/proofs/draws/[slug]/status.ts")

  assert.match(lifecycle, /public\/proofs\/draws\/\$\{encodeURIComponent\(drawRef\.drawSlug\)\}\/status/)
  assert.match(lifecycle, /statusResponse\.status === 404/)
  assert.match(page, /Astro\.response\.status = 404/)
  assert.match(page, /Astro\.response\.status = 410/)
  assert.match(page, /Astro\.response\.status = 503/)
  assert.match(page, /Proof of Fair aktywny/)
  assert.match(page, /Losowanie jest zaplanowane/)
  assert.match(page, /Losowanie jest właśnie wykonywane/)
  assert.match(page, /Wynik zapisany — publikujemy Proof of Fair/)
  assert.match(statusProxy, /max-age=5, s-maxage=10, must-revalidate/)
  assert.match(statusProxy, /no-store/)
})


test("Gorzów friendly proof alias resolves to the canonical CrowdRelay draw slug", () => {
  const refs = read("src/data/drawProofs.ts")
  assert.match(refs, /gorzow-guest-list-2026/)
})


test("accounting keeps monthly totals usable when invoice diagnostics fail", () => {
  const accounting = read("src/components/preact/staff/AccountingManager.tsx")
  assert.match(accounting, /Promise\.allSettled/)
  assert.match(accounting, /if \(previewResult\.status === "rejected"\) throw previewResult\.reason/)
  assert.match(accounting, /setInvoiceListAvailable\(false\)/)
  assert.match(accounting, /Nie potwierdzam pustej listy/)
})


test("accounting cannot finalize a stale month preview", () => {
  const source = read("src/components/preact/staff/AccountingManager.tsx")
  assert.match(source, /const \[loadedMonth, setLoadedMonth\]/)
  assert.match(source, /setLoadedMonth\(nextMonth\)/)
  assert.match(source, /if \(loadedMonth !== month\)/)
  assert.match(source, /disabled=\{busy \|\| loadedMonth !== month/)
  assert.match(source, /Widok pokazuje jeszcze dane za \{loadedMonth\}/)
})
