import "./src/css/index.css"
import React from "react"
import { LanguageProvider } from "./src/i18n/I18nContext"

export const wrapPageElement = ({ element, props }) => (
  <LanguageProvider initialLang={props.pageContext && props.pageContext.lang}>
    {element}
  </LanguageProvider>
)

export const onClientEntry = () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
  navigator.serviceWorker
    .getRegistrations()
    .then(registrations => registrations.forEach(r => r.unregister()))
    .catch(() => {})
  if (typeof caches !== "undefined" && caches.keys) {
    caches
      .keys()
      .then(keys => keys.forEach(k => caches.delete(k)))
      .catch(() => {})
  }
}
