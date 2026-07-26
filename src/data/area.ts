export const AREA_TOKEN_VALUE_PLN = 50

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

// Public campaign data only. Exact claim coordinates and QR secrets are read
// from AREA_LIVE_DROPS_JSON on the server and never enter the browser bundle.
export const AREA_DROPS: AreaDrop[] = [
  {
    id: "wro-001",
    number: "001",
    city: "Wrocław",
    region: "Dolny Śląsk",
    mapX: 34,
    mapY: 70,
    approximateLat: 51.108,
    approximateLng: 17.039,
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
    approximateLat: 52.407,
    approximateLng: 16.929,
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
    approximateLat: 54.352,
    approximateLng: 18.646,
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
    approximateLat: 52.23,
    approximateLng: 21.012,
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
    approximateLat: 50.264,
    approximateLng: 19.023,
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
    approximateLat: 50.065,
    approximateLng: 19.945,
    clue: {
      en: "Old stone. New noise. One line locked inside.",
      pl: "Stary kamień. Nowy hałas. Jedna linia zamknięta w środku.",
    },
  },
]

export const getAreaDrop = (id: string) =>
  AREA_DROPS.find((drop) => drop.id === id)
