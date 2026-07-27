export const AREA_REWARD_CREDITS_PER_CODE = 1

export type AreaLang = "en" | "pl"

export type AreaDrop = {
  id: string
  number: string
  city: string
  region: string
  mapX: number
  mapY: number
  approximateLat: number
  approximateLng: number
  clue: Record<AreaLang, string>
}

// Public campaign data only. These are coarse city-level reference points
// used solely by the client-side "nearest city" helper. Exact claim
// coordinates come from AREA_LIVE_DROPS_JSON on the server.
export const AREA_DROPS: AreaDrop[] = [
  {
    id: "wro-001",
    number: "001",
    city: "Wrocław",
    region: "Dolny Śląsk",
    mapX: 34,
    mapY: 70,
    approximateLat: 51.1,
    approximateLng: 17.0,
    clue: {
      en: "A signal is forming somewhere between concrete, water and noise.",
      pl: "Sygnał zbiera się gdzieś pomiędzy betonem, wodą i hałasem.",
    },
  },
  {
    id: "poz-002",
    number: "002",
    city: "Poznań",
    region: "Wielkopolska",
    mapX: 29,
    mapY: 45,
    approximateLat: 52.4,
    approximateLng: 16.9,
    clue: {
      en: "Follow the gold signal. Leave the obvious route behind.",
      pl: "Idź za złotym sygnałem. Zostaw oczywistą trasę za sobą.",
    },
  },
  {
    id: "gdn-003",
    number: "003",
    city: "Gdańsk",
    region: "Pomorze",
    mapX: 49,
    mapY: 17,
    approximateLat: 54.4,
    approximateLng: 18.6,
    clue: {
      en: "Look for the echo where steel meets salt.",
      pl: "Szukaj echa tam, gdzie stal spotyka sól.",
    },
  },
  {
    id: "waw-004",
    number: "004",
    city: "Warszawa",
    region: "Mazowsze",
    mapX: 68,
    mapY: 48,
    approximateLat: 52.2,
    approximateLng: 21.0,
    clue: {
      en: "The loudest city hides its quietest transmission.",
      pl: "Najgłośniejsze miasto ukrywa najcichszą transmisję.",
    },
  },
  {
    id: "ktw-005",
    number: "005",
    city: "Katowice",
    region: "Śląsk",
    mapX: 53,
    mapY: 79,
    approximateLat: 50.3,
    approximateLng: 19.0,
    clue: {
      en: "An industrial pulse is waiting below the surface.",
      pl: "Przemysłowy puls czeka tuż pod powierzchnią.",
    },
  },
  {
    id: "krk-006",
    number: "006",
    city: "Kraków",
    region: "Małopolska",
    mapX: 65,
    mapY: 86,
    approximateLat: 50.1,
    approximateLng: 19.9,
    clue: {
      en: "Old stone. New noise. One line locked inside.",
      pl: "Stary kamień. Nowy hałas. Jedna linia zamknięta w środku.",
    },
  },
  {
    id: "ldz-007",
    number: "007",
    city: "Łódź",
    region: "Łódzkie",
    mapX: 53,
    mapY: 56,
    approximateLat: 51.8,
    approximateLng: 19.5,
    clue: {
      en: "Follow the thread through brick, rails and reinvention.",
      pl: "Idź za nicią przez cegłę, tory i miasto wymyślone na nowo.",
    },
  },
  {
    id: "szc-008",
    number: "008",
    city: "Szczecin",
    region: "Zachodniopomorskie",
    mapX: 14,
    mapY: 29,
    approximateLat: 53.4,
    approximateLng: 14.6,
    clue: {
      en: "The signal drifts inland from water shaped like a maze.",
      pl: "Sygnał płynie w głąb lądu od wody ułożonej jak labirynt.",
    },
  },
  {
    id: "lub-009",
    number: "009",
    city: "Lublin",
    region: "Lubelskie",
    mapX: 82,
    mapY: 63,
    approximateLat: 51.2,
    approximateLng: 22.6,
    clue: {
      en: "Listen where old gates carry a new frequency.",
      pl: "Słuchaj tam, gdzie stare bramy niosą nową częstotliwość.",
    },
  },
  {
    id: "rze-010",
    number: "010",
    city: "Rzeszów",
    region: "Podkarpackie",
    mapX: 82,
    mapY: 87,
    approximateLat: 50.0,
    approximateLng: 22.0,
    clue: {
      en: "A southern pulse hides between motion and open sky.",
      pl: "Południowy puls ukrywa się między ruchem a otwartym niebem.",
    },
  },
  {
    id: "bia-011",
    number: "011",
    city: "Białystok",
    region: "Podlaskie",
    mapX: 85,
    mapY: 35,
    approximateLat: 53.1,
    approximateLng: 23.2,
    clue: {
      en: "At the forest's edge, the quiet signal travels furthest.",
      pl: "Na skraju lasu cichy sygnał dociera najdalej.",
    },
  },
  {
    id: "tor-012",
    number: "012",
    city: "Toruń",
    region: "Kujawsko-Pomorskie",
    mapX: 47,
    mapY: 37,
    approximateLat: 53.0,
    approximateLng: 18.6,
    clue: {
      en: "Look up, then follow the orbit back to the street.",
      pl: "Spójrz w górę, potem sprowadź orbitę z powrotem na ulicę.",
    },
  },
]

export const getAreaDrop = (id: string) =>
  AREA_DROPS.find(drop => drop.id === id)
