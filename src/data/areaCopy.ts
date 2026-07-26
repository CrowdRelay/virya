import type { AreaLang } from "./area"

export const AREA_COPY: Record<AreaLang, Record<string, any>> = {
  en: {
    meta: {
      title: "VIRYA Area — Find the signal. Unlock the line.",
      description:
        "A location-based VIRYA treasure hunt across Poland. Find hidden drops, unlock lyric collectibles and earn merch credits.",
    },
    hero: {
      eyebrow: "Location game · Poland · Pilot",
      title: "Poland is the map. Our words are the loot.",
      body:
        "We are planting VIRYA boxes in cities across Poland. Reach the zone, find the physical marker, scan its QR or NFC tag and unlock a lyric collectible plus 1 VIRYA Credit.",
      mapCta: "Open the pilot map",
      howCta: "How it works",
      pilot: "Pilot signal",
      pilotBody:
        "The infrastructure is armed. A city becomes claimable only when we publish an active drop.",
      teaserLine: "[ SIGNAL LOCKED ]",
      teaserTrack: "Unknown transmission · 001",
    },
    stats: {
      value: "20 PLN",
      valueLabel: "off merch per credit",
      cities: "6",
      citiesLabel: "pilot city signals",
      tracking: "0×",
      trackingLabel: "background tracking",
    },
    map: {
      eyebrow: "Area // Poland",
      heading: "Track the next box",
      body:
        "The map reveals a city and an approximate zone. The final metres belong to the street, the clue and your instincts.",
      mapLabel: "Stylised map of Poland with VIRYA drop cities",
      signal: "Signal",
      live: "Live now",
      claimed: "Collected",
      selected: "Selected drop",
      coordinates: "Approximate zone",
      encrypted: "Coordinates encrypted until the signal goes live.",
      nearest: "Find my nearest signal",
      nearestNote:
        "Your position is compared on this device. It is not sent or saved for this search.",
      locationWorking: "Reading your position…",
      locationDenied:
        "Location was not available. Allow it in browser settings or choose a city from the list.",
      nearestResult: (city: string, distance: string) =>
        `${city} is your nearest signal — about ${distance} away.`,
      selectAria: (city: string) => `Select the ${city} VIRYA Area drop`,
      markerAria: (city: string) => `${city} VIRYA Area marker`,
    },
    claim: {
      eyebrow: "Physical signal detected",
      heading: "You found the box",
      body:
        "The code is loaded. We now need one fresh location reading to confirm that you are standing inside the drop zone.",
      privacy:
        "The server checks distance and accuracy, then discards the raw coordinates. No route or background location is stored.",
      button: "Confirm location & unlock",
      working: "Checking the signal…",
      success: "Signal decoded. The collectible is now yours.",
      already: "You already collected this drop.",
      missing:
        "This scan is incomplete. Scan the original QR or NFC tag on the physical box.",
      genericError: "The signal could not be verified. Try again at the box.",
      inactive: "This signal is not live right now.",
      invalidCode: "This is not a valid physical-box code.",
      accuracy: "Location is too imprecise. Move outdoors and try again.",
      outside: "You are outside the active drop zone.",
      full: "This drop has reached its claim limit.",
      rateLimited: "Too many attempts. Wait a few minutes and try again.",
    },
    collection: {
      eyebrow: "Your collection",
      heading: "Echoes recovered",
      body:
        "Each valid box reveals one line from our songs. The line stays in the VIRYA Area wallet linked to this browser.",
      progress: "Echoes recovered",
      complete: "Full signal recovered",
      completeBody:
        "You recovered every Echo in this season. The final collector reward will unlock here.",
      locked: "Encrypted collectible",
      unlocked: "Unlocked",
      recoveredOn: "Recovered",
      editionNumber: "Artifact",
      riddle: "Riddle",
      wallet: "VIRYA balance",
      walletUnit: "Credits",
      walletValue: "merch value",
      loading: "Loading wallet…",
      browserNote:
        "Pilot wallet: keep this browser's site data. Account recovery arrives before the public season.",
      voucherHeading: "Turn Credits into a merch code",
      voucherBody:
        "Choose 1–5 Credits. You will receive one single-use Stripe code. Minimum order equals the discount plus 20 PLN.",
      voucherButton: "Create merch code",
      voucherWorking: "Creating a one-time code…",
      voucherEmpty: "Find a live drop to earn your first Credit.",
      voucherSuccess: "Your code is ready. Enter it at Stripe Checkout.",
      voucherError: "The merch code could not be created. Your balance is safe.",
      codes: "Your merch codes",
      copyCode: "Copy code",
      copied: "Code copied",
      shop: "Go to the merch store",
    },
    steps: {
      eyebrow: "Game loop",
      heading: "Three moves. One signal.",
      items: [
        {
          number: "01",
          title: "Track the box",
          body:
            "Watch the map and socials. We reveal the city, time window and a clue — never a boring pin straight to the prize.",
        },
        {
          number: "02",
          title: "Scan on location",
          body:
            "The phone's normal camera opens a protected QR link. NFC can open the same link. No camera permission on the website.",
        },
        {
          number: "03",
          title: "Unlock & use",
          body:
            "A valid scan unlocks the lyric collectible and 1 VIRYA Credit, worth 20 PLN off in the merch store.",
        },
      ],
    },
    share: {
      eyebrow: "Social signal",
      heading: "Leave a clue, not a spoiler.",
      body:
        "Share the city and your unlocked line. Exact coordinates and scan data never enter the post.",
      button: "Share VIRYA Area",
      copied: "Share text copied",
      generic:
        "VIRYA Area is waking up across Poland. Find a box, unlock a lyric and earn merch credit. Who catches the next signal? #ViryaArea #StayMad",
      claimed: (city: string, line: string) =>
        `I found a VIRYA Area drop in ${city} and unlocked “${line}” Who catches the next signal? #ViryaArea #StayMad`,
    },
    rules: {
      eyebrow: "Pilot rules",
      heading: "Real hunt. Clear rules.",
      items: [
        "One collectible and 1 Credit per wallet per drop.",
        "1 VIRYA Credit = 20 PLN off. Credits are free, non-transferable and cannot be exchanged for cash.",
        "A generated merch code is single-use, expires after 12 months and requires an order at least 20 PLN higher than its discount.",
        "Location is requested only after you choose to check a signal or claim a physical box. No background tracking.",
        "Stay on public, safe ground. Never enter private property, tracks, roads, rooftops or construction sites.",
        "Pilot collectibles and Credits are a loyalty feature, not cryptocurrency, an investment or a financial product.",
      ],
      chain:
        "Optional on-chain minting can come later for the collectible artwork. The merch Credit will remain off-chain and no precise location will ever be written to a blockchain.",
      privacy: "Read the privacy policy",
      terms: "Read the store terms",
    },
    teaser: {
      eyebrow: "New // VIRYA Area",
      heading: "The next release might be hidden in your city.",
      body:
        "Find a physical VIRYA box, decode a line from our lyrics and collect a Credit worth 20 PLN in the merch store.",
      cta: "Enter the Area",
      signal: "Pilot map online",
    },
  },
  pl: {
    meta: {
      title: "VIRYA Area — Znajdź sygnał. Odblokuj wers.",
      description:
        "Geolokalizacyjny treasure hunt VIRYA w Polsce. Znajduj ukryte dropy, odblokowuj kolekcjonerskie wersy i zdobywaj kredyty do merchu.",
    },
    hero: {
      eyebrow: "Gra terenowa · Polska · Pilot",
      title: "Polska jest mapą. Nasze słowa są lootem.",
      body:
        "Rozstawiamy boxy VIRYA w miastach całej Polski. Dotrzyj do strefy, znajdź fizyczny znacznik, zeskanuj QR lub NFC i odblokuj kolekcjonerski wers oraz 1 VIRYA Credit.",
      mapCta: "Otwórz mapę pilota",
      howCta: "Jak to działa",
      pilot: "Sygnał pilota",
      pilotBody:
        "Infrastruktura jest uzbrojona. Miasto staje się dostępne dopiero, gdy opublikujemy aktywny drop.",
      teaserLine: "[ SYGNAŁ ZABLOKOWANY ]",
      teaserTrack: "Nieznana transmisja · 001",
    },
    stats: {
      value: "20 zł",
      valueLabel: "rabatu na merch za Credit",
      cities: "6",
      citiesLabel: "miast w sygnale pilota",
      tracking: "0×",
      trackingLabel: "śledzenia w tle",
    },
    map: {
      eyebrow: "Area // Polska",
      heading: "Namierz następny box",
      body:
        "Mapa ujawnia miasto i przybliżoną strefę. Ostatnie metry należą do ulicy, wskazówki i Twojego instynktu.",
      mapLabel: "Stylizowana mapa Polski z miastami dropów VIRYA",
      signal: "Sygnał",
      live: "Aktywny",
      claimed: "Zebrany",
      selected: "Wybrany drop",
      coordinates: "Przybliżona strefa",
      encrypted: "Koordynaty zaszyfrowane do chwili aktywacji sygnału.",
      nearest: "Znajdź najbliższy sygnał",
      nearestNote:
        "Pozycja jest porównywana na tym urządzeniu. Przy tym wyszukiwaniu niczego nie wysyłamy ani nie zapisujemy.",
      locationWorking: "Odczytuję pozycję…",
      locationDenied:
        "Lokalizacja jest niedostępna. Zezwól na nią w ustawieniach przeglądarki albo wybierz miasto z listy.",
      nearestResult: (city: string, distance: string) =>
        `${city} to Twój najbliższy sygnał — około ${distance}.`,
      selectAria: (city: string) => `Wybierz drop VIRYA Area w mieście ${city}`,
      markerAria: (city: string) => `Znacznik VIRYA Area: ${city}`,
    },
    claim: {
      eyebrow: "Wykryto fizyczny sygnał",
      heading: "Masz box",
      body:
        "Kod jest załadowany. Potrzebujemy teraz jednego świeżego odczytu lokalizacji, żeby potwierdzić, że stoisz w strefie dropu.",
      privacy:
        "Serwer sprawdza odległość i dokładność, a potem odrzuca surowe koordynaty. Nie zapisujemy trasy ani lokalizacji w tle.",
      button: "Potwierdź lokalizację i odblokuj",
      working: "Sprawdzam sygnał…",
      success: "Sygnał odkodowany. Karta jest Twoja.",
      already: "Ten drop jest już w Twojej kolekcji.",
      missing:
        "Skan jest niepełny. Zeskanuj oryginalny QR lub NFC na fizycznym boxie.",
      genericError:
        "Nie udało się potwierdzić sygnału. Spróbuj ponownie przy boxie.",
      inactive: "Ten sygnał nie jest teraz aktywny.",
      invalidCode: "To nie jest prawidłowy kod z fizycznego boxu.",
      accuracy:
        "Lokalizacja jest zbyt niedokładna. Wyjdź na otwartą przestrzeń i spróbuj ponownie.",
      outside: "Jesteś poza aktywną strefą dropu.",
      full: "Limit odbiorów tego dropu został wyczerpany.",
      rateLimited:
        "Za dużo prób. Odczekaj kilka minut i spróbuj ponownie.",
    },
    collection: {
      eyebrow: "Twoja kolekcja",
      heading: "Odzyskane Echoes",
      body:
        "Każdy prawidłowy box odsłania jeden wers z naszych numerów. Karta zostaje w portfelu VIRYA Area powiązanym z tą przeglądarką.",
      progress: "Echoes recovered",
      complete: "Pełny sygnał odzyskany",
      completeBody:
        "Masz wszystkie Echoes z tego sezonu. Finałowa nagroda kolekcjonerska odblokuje się tutaj.",
      locked: "Zaszyfrowana karta",
      unlocked: "Odblokowana",
      recoveredOn: "Odzyskano",
      editionNumber: "Artefakt",
      riddle: "Zagadka",
      wallet: "Saldo VIRYA",
      walletUnit: "Credits",
      walletValue: "wartość w merchu",
      loading: "Ładuję portfel…",
      browserNote:
        "Portfel pilota: zachowaj dane tej strony w przeglądarce. Odzyskiwanie konta pojawi się przed publicznym sezonem.",
      voucherHeading: "Zamień Credits na kod do merchu",
      voucherBody:
        "Wybierz 1–5 Credits. Dostaniesz jeden jednorazowy kod Stripe. Minimalny koszyk to wartość rabatu plus 20 zł.",
      voucherButton: "Utwórz kod do merchu",
      voucherWorking: "Tworzę jednorazowy kod…",
      voucherEmpty: "Znajdź aktywny drop, żeby zdobyć pierwszy Credit.",
      voucherSuccess: "Kod jest gotowy. Wpisz go w Stripe Checkout.",
      voucherError: "Nie udało się utworzyć kodu. Twoje saldo jest bezpieczne.",
      codes: "Twoje kody do merchu",
      copyCode: "Kopiuj kod",
      copied: "Kod skopiowany",
      shop: "Przejdź do sklepu",
    },
    steps: {
      eyebrow: "Pętla gry",
      heading: "Trzy ruchy. Jeden sygnał.",
      items: [
        {
          number: "01",
          title: "Namierz box",
          body:
            "Śledź mapę i sociale. Ujawniamy miasto, okno czasowe i wskazówkę — nigdy nudną pinezkę prowadzącą prosto do nagrody.",
        },
        {
          number: "02",
          title: "Zeskanuj na miejscu",
          body:
            "Zwykły aparat telefonu otwiera chroniony link QR. NFC może otworzyć ten sam link. Strona nie potrzebuje dostępu do kamery.",
        },
        {
          number: "03",
          title: "Odblokuj i użyj",
          body:
            "Prawidłowy skan odsłania kolekcjonerski wers i daje 1 VIRYA Credit wart 20 zł rabatu w sklepie.",
        },
      ],
    },
    share: {
      eyebrow: "Sygnał społeczności",
      heading: "Zostaw trop, nie spoiler.",
      body:
        "Udostępnij miasto i odblokowany wers. Dokładne koordynaty i dane skanu nigdy nie trafiają do posta.",
      button: "Udostępnij VIRYA Area",
      copied: "Tekst do udostępnienia skopiowany",
      generic:
        "VIRYA Area budzi się w całej Polsce. Znajdź box, odblokuj wers i zgarnij Credit do merchu. Kto łapie następny sygnał? #ViryaArea #StayMad",
      claimed: (city: string, line: string) =>
        `Znalazłem drop VIRYA Area w ${city} i odblokowałem „${line}” Kto łapie następny sygnał? #ViryaArea #StayMad`,
    },
    rules: {
      eyebrow: "Zasady pilota",
      heading: "Prawdziwy hunt. Jasne reguły.",
      items: [
        "Jedna karta i 1 Credit na portfel za każdy drop.",
        "1 VIRYA Credit = 20 zł rabatu. Credits są darmowe, niezbywalne i niewymienialne na gotówkę.",
        "Wygenerowany kod jest jednorazowy, wygasa po 12 miesiącach i wymaga koszyka co najmniej o 20 zł wyższego od rabatu.",
        "O lokalizację pytamy tylko, gdy sprawdzasz sygnał lub odbierasz fizyczny box. Zero śledzenia w tle.",
        "Szukaj wyłącznie w bezpiecznych, publicznych miejscach. Nigdy nie wchodź na teren prywatny, tory, jezdnię, dach ani budowę.",
        "Karty i Credits w pilocie są funkcją lojalnościową, a nie kryptowalutą, inwestycją ani produktem finansowym.",
      ],
      chain:
        "Opcjonalny mint on-chain może później objąć grafikę karty. Credit do merchu zostanie off-chain, a dokładna lokalizacja nigdy nie trafi do blockchaina.",
      privacy: "Przeczytaj politykę prywatności",
      terms: "Przeczytaj regulamin sklepu",
    },
    teaser: {
      eyebrow: "Nowość // VIRYA Area",
      heading: "Następny release może być ukryty w Twoim mieście.",
      body:
        "Znajdź fizyczny box VIRYA, odkoduj wers z naszych tekstów i zbierz Credit wart 20 zł w sklepie.",
      cta: "Wejdź do Area",
      signal: "Mapa pilota online",
    },
  },
}
