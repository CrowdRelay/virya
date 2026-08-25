export type NewsLang = "pl" | "en"

export interface LocalizedText {
  pl: string
  en: string
}

export interface NewsPost {
  slug: string
  publishedAt: string
  tag: LocalizedText
  title: LocalizedText
  excerpt: LocalizedText
  body: {
    pl: string[]
    en: string[]
  }
  image: string
  imageAlt: LocalizedText
  latarnikContext: LocalizedText
}

const curatedNewsPosts: NewsPost[] = [
  {
    slug: "marcin-janusinski-wokalista-virya",
    publishedAt: "2026-08-17",
    tag: { pl: "Zespół", en: "Band" },
    title: {
      pl: "Nowy rozdział VIRYA — Marcin Janusiński za mikrofonem",
      en: "A new chapter for VIRYA — Marcin Janusiński on vocals",
    },
    excerpt: {
      pl: "VIRYA wchodzi w nowy etap. Do zespołu oficjalnie dołączył Marcin Janusiński, który obejmuje rolę wokalisty.",
      en: "VIRYA is entering a new chapter. Marcin Janusiński has officially joined the band as vocalist.",
    },
    body: {
      pl: [
        "To dla nas ważny moment i naturalny krok dalej. Marcin wnosi do VIRYI nową energię, sceniczną charyzmę i mocny charakter, który dobrze współgra z kierunkiem, w którym rozwija się zespół.",
        "Przed nami kolejne koncerty, nowa praca i następne rzeczy, którymi będziemy się dzielić już w najbliższym czasie. Cieszymy się, że możemy oficjalnie przywitać Marcina w VIRYI i otworzyć razem ten nowy rozdział.",
      ],
      en: [
        "This is an important moment for us and a natural step forward. Marcin brings new energy, stage presence and a strong character that fits the direction VIRYA is developing in.",
        "More shows, new work and the next things we are building are ahead of us. We are happy to officially welcome Marcin to VIRYA and open this new chapter together.",
      ],
    },
    image: "/images/news/marcin-janusinski-live.jpg",
    imageAlt: {
      pl: "Marcin Janusiński podczas koncertu VIRYA",
      en: "Marcin Janusiński performing live with VIRYA",
    },
    latarnikContext: {
      pl: "W Press Roomie masz aktualne bio, zdjęcia prasowe i bezpośredni kontakt w sprawie wywiadu.",
      en: "The Press Room has the current bio, press photos and a direct route for interview requests.",
    },
  },
  {
    slug: "jesien-2026-najblizsze-koncerty",
    publishedAt: "2026-08-17",
    tag: { pl: "Koncerty", en: "Shows" },
    title: {
      pl: "Jesień z VIRYA — najbliższe koncerty",
      en: "Autumn with VIRYA — upcoming shows",
    },
    excerpt: {
      pl: "Przed VIRYĄ kolejne koncerty w Polsce i Czechach. We wrześniu gramy w Namysłowie i na WrOFF we Wrocławiu, a w październiku w Gorzowie Wielkopolskim i Hradcu Králové.",
      en: "VIRYA has more shows ahead in Poland and Czechia, with September dates in Namysłów and at WrOFF in Wrocław, followed by Gorzów Wielkopolski and Hradec Králové in October.",
    },
    body: {
      pl: [
        "Najbliższe daty to: 05.09 — Namysłów, 11.09 — Wrocław / WrOFF, 17.10 — Gorzów Wielkopolski oraz 30.10 — Hradec Králové.",
        "Szczegóły wydarzeń publikujemy na bieżąco. Jeśli działasz w mediach, radiu, foto albo przy organizacji koncertów, Latarnik daje Ci także materiały i kontekst do konkretnych wydarzeń w jednym miejscu.",
      ],
      en: [
        "The upcoming dates are: 05 Sep — Namysłów, 11 Sep — Wrocław / WrOFF, 17 Oct — Gorzów Wielkopolski and 30 Oct — Hradec Králové.",
        "We publish event details as they are confirmed. If you work in media, radio, photography or live events, Beacon also keeps show-specific materials and context in one place.",
      ],
    },
    image: "/images/gallery/Band and crowd cheer.jpg",
    imageAlt: {
      pl: "VIRYA na scenie z publicznością",
      en: "VIRYA on stage with the crowd",
    },
    latarnikContext: {
      pl: "W Latarniku sprawdzisz koncerty w swoim promieniu, otworzysz materiały wydarzenia i poprosisz o akredytację.",
      en: "Beacon shows events within your radius, show-specific assets and a direct accreditation request path.",
    },
  },
  {
    slug: "virya-signal-latarnik",
    publishedAt: "2026-08-17",
    tag: { pl: "Virya Signal", en: "Virya Signal" },
    title: {
      pl: "VIRYA Signal otwiera Latarnika",
      en: "VIRYA Signal opens Beacon",
    },
    excerpt: {
      pl: "Uruchamiamy Latarnika — wygodny kanał dla mediów, fotografów, radia, twórców, promotorów i lokalnych partnerów VIRYI.",
      en: "We are opening Beacon — a low-friction channel for media, photographers, radio, creators, promoters and VIRYA's local partners.",
    },
    body: {
      pl: [
        "Latarnik powstał po to, żeby najważniejsze rzeczy o VIRYI były zawsze pod ręką — bez przekopywania starych maili, szukania aktualnego EPK czy proszenia kilka razy o te same materiały.",
        "W jednym miejscu zbieramy aktualności, koncerty, Press Room oraz szybki kontakt w sprawie materiałów, akredytacji, wywiadów i współpracy przy wydarzeniach. To nie jest newsletter ani program ambasadorski — zaczynamy od prywatnych zaproszeń dla pierwszych Latarników i od ich feedbacku chcemy rozwijać ten kanał dalej.",
      ],
      en: [
        "Beacon exists so the important things about VIRYA are always within reach — without digging through old emails, hunting for the latest EPK or requesting the same assets again.",
        "It brings together news, shows, the Press Room and a quick route for assets, accreditation, interviews and event collaboration. It is not a newsletter or ambassador programme — we are starting with private invitations to the first Beacons and will evolve the channel from their feedback.",
      ],
    },
    image: "/images/band.webp",
    imageAlt: {
      pl: "VIRYA — oficjalne zdjęcie zespołu",
      en: "VIRYA official band photo",
    },
    latarnikContext: {
      pl: "Jesteś już po właściwej stronie: aktualności, Press Room, koncerty i prośby do zespołu masz w jednym miejscu.",
      en: "You are already on the useful side of it: news, Press Room, shows and direct requests live in one place.",
    },
  },
]

// Single canonical ordering point: every consumer (index page, feed.json,
// detail routes, Latarnik teaser) renders newest-first, and appending a
// misdated entry can no longer break the feed order. The stable sort keeps
// the curated order for equal publishedAt dates.
const byPublishedDesc = (left: NewsPost, right: NewsPost) =>
  right.publishedAt.localeCompare(left.publishedAt)

export const newsPosts: NewsPost[] = [...curatedNewsPosts].sort(byPublishedDesc)

export const formatNewsDate = (value: string, lang: NewsLang) =>
  new Intl.DateTimeFormat(lang === "pl" ? "pl-PL" : "en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`))
