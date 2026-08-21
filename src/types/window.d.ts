export {}

declare global {
  interface Window {
    __viryaNavProgressInstalled?: boolean
    __viryaServiceWorkerScheduled?: boolean
    __viryaNavController?: AbortController
    __viryaNavLifecycleInstalled?: boolean
    __viryaTractionInstalled?: boolean
  }
}
