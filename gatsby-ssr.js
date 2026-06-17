import React from "react"
import { LanguageProvider } from "./src/i18n/I18nContext"

export const wrapPageElement = ({ element, props }) => (
  <LanguageProvider initialLang={props.pageContext && props.pageContext.lang}>
    {element}
  </LanguageProvider>
)

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
