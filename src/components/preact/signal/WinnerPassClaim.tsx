import { useEffect, useState } from "preact/hooks"
import type { Lang } from "../../../i18n/t"
import type { AdmissionPass } from "../../../lib/crowdrelay-client"
import { crowdrelay, readFragmentToken } from "../../../lib/crowdrelay"
import AdmissionPassCard from "./AdmissionPassCard"

interface Props { lang: Lang }
type State = { kind: "working" } | { kind: "ready"; pass: AdmissionPass } | { kind: "missing" } | { kind: "error" }

export default function WinnerPassClaim({ lang }: Props) {
  const [state, setState] = useState<State>({ kind: "working" })
  useEffect(() => {
    const token = readFragmentToken()
    if (!token) { setState({ kind: "missing" }); return }
    let cancelled = false
    void crowdrelay.claimAdmissionPass(token)
      .then(pass => { if (!cancelled) setState({ kind: "ready", pass }) })
      .catch(() => { if (!cancelled) setState({ kind: "error" }) })
    return () => { cancelled = true }
  }, [])

  if (state.kind === "ready") return <AdmissionPassCard lang={lang} pass={state.pass} />
  const message = state.kind === "working"
    ? (lang === "pl" ? "Aktywuję Twoją wejściówkę…" : "Activating your guest pass…")
    : state.kind === "missing"
      ? (lang === "pl" ? "W linku brakuje prywatnego tokenu wejściówki." : "The private pass token is missing from this link.")
      : (lang === "pl" ? "Nie udało się aktywować wejściówki. Link mógł wygasnąć albo zostać wcześniej użyty." : "The pass could not be activated. The link may have expired or already been used.")
  return <section class="virya-panel border-amber-400/30 p-6 sm:p-8" aria-busy={state.kind === "working"}><p class="virya-eyebrow">VIRYA // WIN</p><h1 class="mt-4 text-3xl font-black uppercase text-white">{lang === "pl" ? "Darmowa wejściówka" : "Free guest pass"}</h1><p class="mt-5 text-sm leading-relaxed text-zinc-300" role="status">{message}</p></section>
}
