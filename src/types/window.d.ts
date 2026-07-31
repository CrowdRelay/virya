export {}

declare global {
  interface Window {
    __viryaNavProgressInstalled?: boolean
    __viryaServiceWorkerScheduled?: boolean
  }
}
