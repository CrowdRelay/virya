import { useI18n } from "../../i18n/I18nContext"

const CheckIcon = () => (
  <svg class="w-10 h-10 text-amber-400 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const ErrorIcon = () => (
  <svg class="w-10 h-10 text-red-400 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const Thanks = ({ status, messageKey, errorKey, onDismiss }) => {
  const { t } = useI18n()
  const isSuccess = status === "success"
  return (
    <div
      class={`flex flex-col items-center text-center p-6 border ${isSuccess ? "border-amber-400/30 bg-amber-400/5" : "border-red-400/30 bg-red-400/5"}`}
      role="status"
      aria-live="polite"
    >
      {isSuccess ? <CheckIcon /> : <ErrorIcon />}
      <p class={`text-sm font-bold ${isSuccess ? "text-zinc-100" : "text-red-300"}`}>
        {t(messageKey)}
      </p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          class="mt-4 text-[10px] uppercase tracking-widest text-zinc-500 hover:text-amber-400 transition-colors underline underline-offset-2"
          aria-label={t("contact.dismiss")}
        >
          {t("contact.dismiss")}
        </button>
      )}
    </div>
  )
}

export default Thanks
