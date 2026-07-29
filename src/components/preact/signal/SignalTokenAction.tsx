import { useEffect, useState } from "preact/hooks"
import { SIGNAL_COPY } from "../../../data/signalCopy"
import type { Lang } from "../../../i18n/t"
import { crowdrelay, readFragmentToken } from "../../../lib/crowdrelay"

interface Props {
  lang: Lang
  action: "confirm" | "unsubscribe"
}

type State = "working" | "success" | "error"

export default function SignalTokenAction({ lang, action }: Props) {
  const copy = SIGNAL_COPY[lang].action
  const [state, setState] = useState<State>("working")
  const [message, setMessage] = useState(
    action === "confirm" ? copy.confirmWorking : copy.unsubscribeWorking,
  )

  useEffect(() => {
    const token = readFragmentToken()
    if (!token) {
      setState("error")
      setMessage(copy.missingToken)
      return
    }

    let cancelled = false
    const request =
      action === "confirm"
        ? crowdrelay.confirmFan(token)
        : crowdrelay.unsubscribeFan(token)

    void request
      .then(() => {
        if (cancelled) return
        setState("success")
        setMessage(
          action === "confirm" ? copy.confirmSuccess : copy.unsubscribeSuccess,
        )
      })
      .catch(() => {
        if (cancelled) return
        setState("error")
        setMessage(
          action === "confirm" ? copy.confirmError : copy.unsubscribeError,
        )
      })

    return () => {
      cancelled = true
    }
  }, [action, copy])

  return (
    <section
      class={`relative overflow-hidden border p-6 sm:p-8 ${
        state === "error"
          ? "border-red-400/35 bg-red-400/[.035]"
          : "border-amber-400/35 bg-amber-400/[.035]"
      }`}
      aria-busy={state === "working"}
    >
      <div class="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" aria-hidden="true"></div>
      <p class="text-[9px] font-black uppercase tracking-[.3em] text-amber-400">
        VIRYA // SIGNAL
      </p>
      <h1 class="mt-4 text-3xl font-black uppercase leading-tight text-white">
        {action === "confirm" ? copy.confirmTitle : copy.unsubscribeTitle}
      </h1>
      <p class="mt-5 max-w-2xl text-sm leading-relaxed text-zinc-300" role="status" aria-live="polite">
        {message}
      </p>
      <div class="mt-7 flex flex-wrap gap-3">
        {state === "success" && action === "confirm" && (
          <a
            href={pagePath(lang, "/my-signal/")}
            class="inline-flex min-h-[46px] items-center bg-amber-400 px-5 text-[9px] font-black uppercase tracking-widest text-black hover:bg-amber-300"
          >
            {copy.account}
          </a>
        )}
        <a
          href={pagePath(lang, "/")}
          class="inline-flex min-h-[46px] items-center border border-zinc-700 px-5 text-[9px] font-black uppercase tracking-widest text-zinc-200 hover:border-amber-400 hover:text-amber-400"
        >
          {copy.home}
        </a>
      </div>
    </section>
  )
}

function pagePath(lang: Lang, path: string): string {
  if (path === "/") return lang === "pl" ? "/pl/" : "/"
  return lang === "pl" ? `/pl${path}` : path
}
