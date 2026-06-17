import React from "react"
import { LanguageProvider } from "./src/i18n/I18nContext"

export const wrapPageElement = ({ element, props }) => (
  <LanguageProvider initialLang={props.pageContext && props.pageContext.lang}>
    {element}
  </LanguageProvider>
)

// First-visit smart language routing (no popup), run before React hydrates so it
// never races hydration: on an English URL, if the visitor's saved choice — or
// else their browser language — is Polish, hard-redirect to the matching /pl
// page. English visitors are untouched, so the default pages keep a clean load.
const LANG_REDIRECT = `(function(){try{var p=location.pathname;if(p==='/pl'||p.indexOf('/pl/')===0)return;var pref=localStorage.getItem('virya-lang');if(pref!=='pl'&&pref!=='en'){pref=(navigator.language||'').toLowerCase().indexOf('pl')===0?'pl':'en';}if(pref==='pl'){location.replace('/pl'+p+location.search+location.hash);}}catch(e){}})();`

export const onRenderBody = ({ setHtmlAttributes, setPreBodyComponents }) => {
  setHtmlAttributes({ lang: `en` })
  setPreBodyComponents([
    <script
      key="virya-lang-redirect"
      dangerouslySetInnerHTML={{ __html: LANG_REDIRECT }}
    />,
  ])
}
