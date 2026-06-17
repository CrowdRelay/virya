import "./src/css/index.css"
import React from "react"
import { LanguageProvider } from "./src/i18n/I18nContext"

export const wrapPageElement = ({ element, props }) => (
  <LanguageProvider initialLang={props.pageContext && props.pageContext.lang}>
    {element}
  </LanguageProvider>
)
