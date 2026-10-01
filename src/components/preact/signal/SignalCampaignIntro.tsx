import {useEffect,useState} from "preact/hooks"
import {captureContextFromSearch} from "../../../lib/signalCaptureContext"
export default function SignalCampaignIntro({lang}:{lang:"pl"|"en"}) {
 const [shows,setShows]=useState(false)
 useEffect(()=>setShows(captureContextFromSearch(window.location.search)?.offer === "shows"),[])
 return <div class="virya-container relative max-w-4xl">
  <p class="virya-eyebrow">VIRYA // SIGNAL</p>
  <h1 class="mt-5 text-4xl font-black uppercase leading-tight text-white sm:text-6xl">{shows ? lang === "pl" ? "Złap następny koncert VIRYA" : "Catch the next VIRYA show" : lang === "pl" ? "Muzyka i wiadomości prosto od VIRYA" : "Music and updates straight from VIRYA"}</h1>
  <p class="mt-6 text-base leading-7 text-zinc-300">{shows ? lang === "pl" ? "Dostawaj wiadomości o koncertach. Miasto możesz dodać później." : "Get show updates. You can add your city later." : lang === "pl" ? "Dostawaj wiadomości o nowej muzyce i materiałach zespołu." : "Get updates about new music and band material."}</p>
  <p class="mt-4 text-sm text-zinc-400">{lang === "pl" ? "E-mail, Twoja zgoda i potwierdzenie w skrzynce. Bez hasła. Aplikacja jest opcjonalna." : "Email, your consent and inbox confirmation. No password. The app is optional."}</p>
  <div class="mt-7 flex flex-wrap gap-3"><a href="#join-signal" class="virya-button virya-button--primary">{lang === "pl" ? "Zapisz mnie" : "Keep me updated"}</a><a href={lang === "pl" ? "/pl/my-signal/" : "/my-signal/"} class="virya-button virya-button--secondary">{lang === "pl" ? "Mam już konto" : "I already joined"}</a></div>
 </div>
}
