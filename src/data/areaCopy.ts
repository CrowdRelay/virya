import type { AreaLang } from "./area"

export const AREA_COPY = {
  en: {
    meta: {
      title: "VIRYA Area — Find the signal. Unlock the line.",
      description:
        "A 12-city location game across Poland. Reach live zones, unlock lyric collectibles and earn a free merch item with free delivery.",
    },
    hero: {
      eyebrow: "Location game · Poland · Pilot",
      title: "Poland is the map. Our words are the loot.",
      body:
        "Follow the clues, reach a live VIRYA zone and lock the signal with your phone. A verified find unlocks a lyric collectible plus 1 VIRYA Credit.",
      mapCta: "Open the pilot map",
      howCta: "How it works",
      pilot: "Pilot signal",
      pilotBody:
        "A city becomes claimable only while we publish an active signal. No sticker, QR code or hidden physical object is required.",
      teaserLine: "[ SIGNAL LOCKED ]",
      teaserTrack: "Unknown transmission · 001",
    },
    stats: {
      value: "1 MERCH",
      valueLabel: "free with each reward code",
      cities: "12",
      citiesLabel: "pilot city signals",
      tracking: "0×",
      trackingLabel: "background tracking",
    },
    map: {
      eyebrow: "Area // Poland",
      heading: "Track the next signal",
      body:
        "The map reveals a city and an approximate zone. The final metres belong to the street, the clue and your instincts.",
      mapLabel: "Stylised map of Poland with VIRYA drop cities",
      signal: "Signal",
      live: "Live now",
      claimed: "Collected",
      selected: "Selected drop",
      coordinates: "Approximate zone",
      encrypted: "Exact coordinates stay encrypted. Follow the clue inside the announced city zone.",
      nearest: "Find my nearest signal",
      nearestNote:
        "Your position is compared on this device. It is not sent or saved for this search.",
      locationWorking: "Reading your position…",
      locationDenied:
        "Location was not available. Allow it in browser settings or choose a city from the list.",
      locationUnavailable:
        "Your position could not be determined. Move outdoors, enable precise location and try again.",
      locationTimeout:
        "Location took too long. Keep the page open, move outdoors and try again.",
      liveStateLoading: "Checking which signals are live…",
      liveStateUnavailable:
        "Live signal status is temporarily unavailable. Refresh the page in a moment.",
      noActiveSignals:
        "There is no live signal now. Come back later; do not search on your own.",
      nearestResult: (city: string, distance: string) =>
        `${city} is your nearest signal — about ${distance} away.`,
      selectAria: (city: string) => `Select the ${city} VIRYA Area drop`,
      markerAria: (city: string) => `${city} VIRYA Area marker`,
    },
    claim: {
      eyebrow: "Live signal detected",
      heading: "Lock the zone",
      body:
        "When you believe you reached the place from the clue, start signal lock. The phone gathers several fresh GPS readings for a few seconds and the server verifies that you stayed inside the live zone.",
      privacy:
        "Raw coordinates and individual readings are discarded after verification. We store only the unlocked drop, approximate verification distance and time. No route or background location is stored.",
      button: "Lock signal & unlock",
      working: "Starting secure signal lock…",
      collecting: "Hold position outdoors — sample {current}/{total}",
      success:
        "Signal decoded. The collectible and 1 VIRYA Credit are now yours.",
      already: "You already collected this drop.",
      missing: "Select a live city signal first.",
      genericError:
        "The signal could not be verified. Stay in the zone and try again outdoors.",
      inactive: "This signal is not live right now.",
      invalidCode: "The location challenge expired. Start signal lock again.",
      accuracy: "Location is too imprecise. Move outdoors and try again.",
      samples: "Not enough fresh GPS readings. Keep the page open and retry.",
      outside: "You are outside the active drop zone.",
      full: "This drop has reached its claim limit.",
      rateLimited: "Too many attempts. Wait a few minutes and try again.",
      accountRequired:
        "Sign in to your player profile before locking a live signal.",
      accountCta: "Open player profile",
      accountChecking: "Checking your player profile…",
    },
    profile: {
      eyebrow: "Player identity",
      heading: "Carry your Area with you",
      body:
        "Use a magic link to keep collectibles and Credits with your player profile across devices. We never show or share your full email.",
      loggedOut: "Sign in with a one-time link",
      emailLabel: "Email address",
      emailPlaceholder: "you@example.com",
      requestButton: "Send magic link",
      requestWorking: "Sending secure link…",
      requestSent:
        "Check your inbox and open the link on this device. Then return to the live zone and lock the signal.",
      requestError: "The sign-in link could not be sent. Try again.",
      verifying: "Verifying your secure sign-in…",
      verifySuccess: "Player profile connected.",
      verifyError: "This sign-in link is invalid or has expired. Request a new one.",
      signedIn: "Signed in",
      signedInAs: "Player profile",
      signOut: "Sign out",
      signOutWorking: "Signing out…",
      signOutError: "Could not sign out. Try again.",
      migrationTitle: "Browser collection detected",
      migrationBody:
        "Your earlier browser wallet is ready to be linked to this player profile. Keep this browser data until migration completes.",
      unavailable:
        "Profile status is temporarily unavailable. Your existing collection is safe.",
      claimNote:
        "A signed-in profile is required to claim a drop and prevents the same player from farming the reward on multiple browser cookies.",
    },
    collection: {
      eyebrow: "Your collection",
      heading: "Echoes recovered",
      body:
        "Each verified zone reveals one line from our songs. Your collection and Credits stay with the signed-in VIRYA Area profile.",
      progress: "Echoes recovered",
      complete: "Full signal recovered",
      completeBody:
        "You recovered every Echo in this season. The final collector reward will unlock here.",
      locked: "Encrypted collectible",
      unlocked: "Unlocked",
      recoveredOn: "Recovered",
      editionNumber: "Artifact",
      riddle: "Riddle",
      artworkAlt: "Unlocked VIRYA Area collectible artwork",
      artworkPending: "Collectible artwork is syncing",
      wallet: "VIRYA balance",
      walletUnit: "Credits",
      walletValue: "free reward codes available",
      loading: "Loading wallet…",
      browserNote:
        "One Credit creates one single-use reward code. The code makes one item in the cart free and removes InPost delivery cost.",
      voucherHeading: "Turn 1 Credit into a winning code",
      voucherBody:
        "Create a single-use VIRYA Area code. Add any available merch item to the cart; the highest-priced single unit becomes free and InPost delivery is free too.",
      voucherButton: "Create winning code",
      voucherWorking: "Creating a one-time reward code…",
      voucherEmpty: "Find a live drop to earn your first Credit.",
      voucherSuccess: "Your winning code is ready. Copy it and use it in the merch cart.",
      voucherError: "The reward code could not be created. Your Credit is safe.",
      codes: "Your winning codes",
      codeBenefit: "1 free item + free InPost delivery",
      codeIssued: "Ready",
      codeReserved: "Checkout open",
      codeRedeemed: "Used",
      copyCode: "Copy code",
      copied: "Code copied",
      shop: "Choose your free merch",
    },
    community: {
      eyebrow: "Community signal",
      heading: "Poland unlocks this together",
      body:
        "Every verified zone find moves the shared signal. Community progress contains counts only — never player identities or locations.",
      progress: "Verified community finds",
      loading: "Reading the community signal…",
      unavailable: "Community progress will appear when the signal responds.",
      complete: "Community signal complete",
    },
    steps: {
      eyebrow: "Game loop",
      heading: "Three moves. One signal.",
      items: [
        {
          number: "01",
          title: "Follow the clue",
          body:
            "Watch the map and socials. We reveal the city, live window and a clue — not the exact prize coordinates.",
        },
        {
          number: "02",
          title: "Lock the signal",
          body:
            "Reach the place, open VIRYA Area and hold position while the phone gathers several fresh GPS readings. No QR or sticker is required.",
        },
        {
          number: "03",
          title: "Unlock & redeem",
          body:
            "A verified find unlocks a lyric collectible and 1 Credit. Convert it into a code for one free merch item and free InPost delivery.",
        },
      ],
    },
    share: {
      eyebrow: "Social signal",
      heading: "Leave a clue, not a spoiler.",
      body:
        "Share the city and your unlocked line. Exact coordinates and verification readings never enter the post.",
      button: "Share VIRYA Area",
      copied: "Share text copied",
      generic:
        "VIRYA Area is waking up across Poland. Reach a signal, unlock a lyric and win free merch. Who catches the next one? #ViryaArea #StayMad",
      claimed: (city: string, line: string) =>
        `I locked a VIRYA Area signal in ${city} and unlocked “${line}” Who catches the next one? #ViryaArea #StayMad`,
    },
    rules: {
      eyebrow: "Pilot rules",
      heading: "Real hunt. Clear rules.",
      items: [
        "One collectible and 1 Credit per player profile per drop.",
        "1 Credit creates one single-use code for one free available merch item and free InPost delivery in the same order.",
        "When several units are in the cart, the highest-priced single unit is free. Other units remain payable. The code expires after 12 months.",
        "Location is requested only after you start signal lock. We collect several short-lived readings and never track in the background.",
        "Stay on public, safe ground. Never enter private property, tracks, roads, rooftops or construction sites.",
        "Collectibles and Credits are a loyalty feature, not cryptocurrency, an investment or a financial product.",
      ],
      chain:
        "Optional on-chain minting can come later for collectible artwork. The merch reward stays off-chain and no precise location is written to a blockchain.",
      privacy: "Read the privacy policy",
      terms: "Read the store terms",
    },
    teaser: {
      eyebrow: "New // VIRYA Area",
      heading: "The next release might be hidden in your city.",
      body:
        "Reach a live signal, decode a line from our lyrics and win one free merch item with free delivery.",
      cta: "Enter the Area",
      signal: "Pilot map online",
    },
    mode: {
      hunt: "Map",
      collection: "Collection",
      rewards: "Rewards",
      collectionCta: "See your collection",
      lockedHint:
        "Locked lines open once you verify a find at a live zone.",
    },
  },
  pl: {
    meta: {
      title: "Gra Virya — znajdź strefę, odblokuj wers, odbierz nagrodę.",
      description:
        "Gra geolokalizacyjna VIRYA. Pokazujemy tylko aktualnie aktywne strefy — nie musisz odwiedzać 12 miast ani zbierać całej Polski.",
    },
    hero: {
      eyebrow: "Gra terenowa Viryi · Polska",
      title: "Znajdź strefę. Odblokuj wers. Wygraj merch.",
      body:
        "Wybierz aktywne miasto, otwórz przybliżony punkt startowy, idź za wskazówką i potwierdź lokalizację telefonem. Dokładną nagrodę aktywnej kampanii zobaczysz po znalezieniu strefy.",
      mapCta: "Sprawdź aktywne miasta",
      howCta: "Jak to działa",
      pilot: "Ważne",
      pilotBody:
        "Gra działa tylko w ogłoszonych godzinach i strefach. Nie szukasz naklejki ani przedmiotu — telefon potwierdza, że dotarłeś na miejsce.",
      teaserLine: "[ SYGNAŁ ZABLOKOWANY ]",
      teaserTrack: "Nieznana transmisja · 001",
    },
    stats: {
      value: "1 MERCH",
      valueLabel: "nagroda aktywnej kampanii",
      cities: "12",
      citiesLabel: "miast w sygnale pilota",
      tracking: "0×",
      trackingLabel: "śledzenia w tle",
    },
    map: {
      eyebrow: "Gra Virya // Polska",
      heading: "Wybierz miasto i znajdź strefę",
      body:
        "Wybierz aktywne miasto. Mapa pokaże przybliżony obszar, a wskazówka pomoże Ci znaleźć właściwe miejsce.",
      mapLabel: "Stylizowana mapa Polski z miastami stref Gry Virya",
      signal: "Sygnał",
      live: "Aktywny",
      claimed: "Zebrany",
      selected: "Wybrana strefa",
      coordinates: "Przybliżona strefa",
      encrypted: "Dokładne koordynaty pozostają zaszyfrowane. Idź za wskazówką w ogłoszonej strefie miasta.",
      nearest: "Znajdź najbliższy sygnał",
      nearestNote:
        "Pozycja jest porównywana na tym urządzeniu. Przy tym wyszukiwaniu niczego nie wysyłamy ani nie zapisujemy.",
      locationWorking: "Odczytuję pozycję…",
      locationDenied:
        "Lokalizacja jest niedostępna. Zezwól na nią w ustawieniach przeglądarki albo wybierz miasto z listy.",
      locationUnavailable:
        "Nie udało się ustalić pozycji. Wyjdź na zewnątrz, włącz dokładną lokalizację i spróbuj ponownie.",
      locationTimeout:
        "Odczyt lokalizacji trwał zbyt długo. Zostaw stronę otwartą, wyjdź na zewnątrz i spróbuj ponownie.",
      liveStateLoading: "Sprawdzam, które sygnały są aktywne…",
      liveStateUnavailable:
        "Status aktywnych sygnałów jest chwilowo niedostępny. Odśwież stronę za moment.",
      noActiveSignals:
        "Teraz nie ma aktywnego sygnału. Wróć później — nie musisz niczego szukać na własną rękę.",
      nearestResult: (city: string, distance: string) =>
        `${city} to Twój najbliższy sygnał — około ${distance}.`,
      selectAria: (city: string) => `Wybierz strefę Gry Virya w mieście ${city}`,
      markerAria: (city: string) => `Znacznik Gry Virya: ${city}`,
    },
    claim: {
      eyebrow: "Wykryto aktywny sygnał",
      heading: "Potwierdź, że jesteś w strefie",
      body:
        "Po dotarciu na miejsce uruchom weryfikację. Telefon przez kilka sekund sprawdzi lokalizację i potwierdzi, czy jesteś w aktywnej strefie.",
      privacy:
        "Po weryfikacji odrzucamy surowe koordynaty i pojedyncze pomiary. Zapisujemy tylko odblokowaną strefę, orientacyjny dystans weryfikacji i czas. Nie zapisujemy trasy ani lokalizacji w tle.",
      button: "Sprawdź lokalizację i odbierz nagrodę",
      working: "Uruchamiam bezpieczną blokadę sygnału…",
      collecting: "Pozostań na miejscu pod gołym niebem — pomiar {current}/{total}",
      success:
        "Sygnał odkodowany. Karta i 1 punkt Virya są Twoje.",
      already: "Ta strefa jest już w Twojej kolekcji.",
      missing: "Najpierw wybierz aktywny sygnał miasta.",
      genericError:
        "Nie udało się potwierdzić sygnału. Pozostań w strefie i spróbuj ponownie na otwartej przestrzeni.",
      inactive: "Ten sygnał nie jest teraz aktywny.",
      invalidCode: "Wyzwanie lokalizacyjne wygasło. Uruchom blokadę sygnału ponownie.",
      accuracy:
        "Lokalizacja jest zbyt niedokładna. Wyjdź na otwartą przestrzeń i spróbuj ponownie.",
      samples:
        "Za mało świeżych pomiarów GPS. Zostaw stronę otwartą i spróbuj ponownie.",
      outside: "Jesteś poza aktywną strefą gry.",
      full: "Limit odbiorów tej strefy został wyczerpany.",
      rateLimited: "Za dużo prób. Odczekaj kilka minut i spróbuj ponownie.",
      accountRequired:
        "Zaloguj się do profilu gracza, zanim zablokujesz aktywny sygnał.",
      accountCta: "Otwórz profil gracza",
      accountChecking: "Sprawdzam profil gracza…",
    },
    profile: {
      eyebrow: "Krok 1 · profil gracza",
      heading: "Zaloguj się, żeby zachować nagrody",
      body:
        "Podaj e-mail i otwórz jednorazowy link. Dzięki temu kolekcja i zdobyte kody nie znikną po zmianie telefonu lub przeglądarki.",
      loggedOut: "Wyślij mi link logowania",
      emailLabel: "Adres e-mail",
      emailPlaceholder: "ty@example.com",
      requestButton: "Wyślij magic link",
      requestWorking: "Wysyłam bezpieczny link…",
      requestSent:
        "Sprawdź skrzynkę i otwórz link na tym urządzeniu. Potem wróć do aktywnej strefy i zablokuj sygnał.",
      requestError: "Nie udało się wysłać linku logowania. Spróbuj ponownie.",
      verifying: "Potwierdzam bezpieczne logowanie…",
      verifySuccess: "Profil gracza połączony.",
      verifyError: "Link logowania jest nieprawidłowy albo wygasł. Poproś o nowy.",
      signedIn: "Zalogowano",
      signedInAs: "Profil gracza",
      signOut: "Wyloguj się",
      signOutWorking: "Wylogowuję…",
      signOutError: "Nie udało się wylogować. Spróbuj ponownie.",
      migrationTitle: "Wykryto kolekcję w przeglądarce",
      migrationBody:
        "Twój wcześniejszy portfel w przeglądarce jest gotowy do połączenia z profilem gracza. Zachowaj dane tej strony do końca migracji.",
      unavailable:
        "Status profilu jest chwilowo niedostępny. Twoja kolekcja jest bezpieczna.",
      claimNote:
        "Odbiór wymaga zalogowanego profilu. Dzięki temu ten sam gracz nie może farmić nagrody przez czyszczenie cookies.",
    },
    collection: {
      eyebrow: "Twoja kolekcja",
      heading: "Odzyskane Echoes",
      body:
        "Każda potwierdzona strefa odsłania jeden wers z naszych numerów. Kolekcja i punkty zostają na zalogowanym profilu Gry Virya.",
      progress: "Odzyskane Echoes",
      complete: "Pełny sygnał odzyskany",
      completeBody:
        "Masz wszystkie Echoes z tego sezonu. Finałowa nagroda kolekcjonerska odblokuje się tutaj.",
      locked: "Zaszyfrowana karta",
      unlocked: "Odblokowana",
      recoveredOn: "Odzyskano",
      editionNumber: "Artefakt",
      riddle: "Zagadka",
      artworkAlt: "Odblokowana grafika kolekcjonerska Gra Virya",
      artworkPending: "Grafika kolekcjonerska jest synchronizowana",
      wallet: "Saldo VIRYA",
      walletUnit: "punkty",
      walletValue: "dostępne kody nagród",
      loading: "Ładuję portfel…",
      browserNote:
        "Jeden punkt tworzy jeden jednorazowy kod. Kod zeruje cenę jednego produktu w koszyku i koszt dostawy InPost.",
      voucherHeading: "Zamień 1 punkt na wygrany kod",
      voucherBody:
        "Utwórz jednorazowy kod nagrody. Dodaj do koszyka dowolny dostępny merch; najdroższa pojedyncza sztuka będzie gratis, a dostawa InPost również będzie darmowa.",
      voucherButton: "Utwórz wygrany kod",
      voucherWorking: "Tworzę jednorazowy kod nagrody…",
      voucherEmpty: "Znajdź aktywną strefę, żeby zdobyć pierwszy punkt.",
      voucherSuccess: "Wygrany kod jest gotowy. Skopiuj go i użyj w koszyku merchu.",
      voucherError: "Nie udało się utworzyć kodu nagrody. Twój punkt jest bezpieczny.",
      codes: "Twoje wygrane kody",
      codeBenefit: "1 produkt gratis + darmowa dostawa InPost",
      codeIssued: "Gotowy",
      codeReserved: "Checkout otwarty",
      codeRedeemed: "Wykorzystany",
      copyCode: "Kopiuj kod",
      copied: "Kod skopiowany",
      shop: "Wybierz darmowy merch",
    },
    community: {
      eyebrow: "Sygnał społeczności",
      heading: "Polska odblokowuje to razem",
      body:
        "Każde potwierdzone znalezisko strefy wzmacnia wspólny sygnał. Postęp społeczności zawiera wyłącznie liczby — nigdy dane graczy ani lokalizacje.",
      progress: "Potwierdzone znaleziska społeczności",
      loading: "Odczytuję sygnał społeczności…",
      unavailable: "Postęp społeczności pojawi się, gdy sygnał odpowie.",
      complete: "Sygnał społeczności ukończony",
    },
    steps: {
      eyebrow: "Pętla gry",
      heading: "Trzy kroki. Prościej się nie da.",
      items: [
        {
          number: "01",
          title: "Idź za wskazówką",
          body:
            "Śledź mapę i sociale. Ujawniamy miasto, czas aktywności i trop — nie dokładne koordynaty nagrody.",
        },
        {
          number: "02",
          title: "Zablokuj sygnał",
          body:
            "Dotrzyj na miejsce, otwórz Grę Virya i naciśnij przycisk weryfikacji. Pozostań chwilę w strefie; QR ani naklejka nie są potrzebne.",
        },
        {
          number: "03",
          title: "Odblokuj i odbierz",
          body:
            "Potwierdzone znalezisko odsłania wers i zapisuje nagrodę w portfelu. Dokładny benefit i termin ważności zobaczysz przed utworzeniem kodu.",
        },
      ],
    },
    share: {
      eyebrow: "Sygnał społeczności",
      heading: "Zostaw trop, nie spoiler.",
      body:
        "Udostępnij miasto i odblokowany wers. Dokładne koordynaty oraz pomiary weryfikacyjne nigdy nie trafiają do posta.",
      button: "Udostępnij Grę Virya",
      copied: "Tekst do udostępnienia skopiowany",
      generic:
        "Gra Virya jest aktywna tam, gdzie pojawi się sygnał. Dotrzyj do strefy i odblokuj kolekcjonerski wers. #ViryaArea #StayMad",
      claimed: (city: string, line: string) =>
        `Znalazłem strefę Gry Virya w ${city} i odblokowałem „${line}” Kto łapie następny? #ViryaArea #StayMad`,
    },
    rules: {
      eyebrow: "Zasady pilota",
      heading: "Prawdziwy hunt. Jasne reguły.",
      items: [
        "Jedna karta i 1 punkt na profil gracza za każdą strefę.",
        "1 punkt tworzy jeden jednorazowy kod na jeden dowolny dostępny produkt gratis i darmową dostawę InPost w tym samym zamówieniu.",
        "Przy kilku sztukach w koszyku gratis jest najdroższa pojedyncza sztuka. Pozostałe są płatne. Kod wygasa po 12 miesiącach.",
        "O lokalizację pytamy tylko po uruchomieniu blokady sygnału. Zbieramy kilka krótkotrwałych pomiarów i nie śledzimy w tle.",
        "Szukaj wyłącznie w bezpiecznych, publicznych miejscach. Nigdy nie wchodź na teren prywatny, tory, jezdnię, dach ani budowę.",
        "Karty i punkty są funkcją lojalnościową, a nie kryptowalutą, inwestycją ani produktem finansowym.",
      ],
      chain:
        "Opcjonalny mint on-chain może później objąć grafikę karty. Nagroda merchowa pozostaje off-chain, a dokładna lokalizacja nigdy nie trafi do blockchaina.",
      privacy: "Przeczytaj politykę prywatności",
      terms: "Przeczytaj regulamin sklepu",
    },
    teaser: {
      eyebrow: "Nowość // Gra Virya",
      heading: "Następny release może być ukryty w Twoim mieście.",
      body:
        "Dotrzyj do aktualnie aktywnego sygnału, odkoduj wers z naszych tekstów i odbierz nagrodę tej kampanii.",
      cta: "Otwórz Grę Virya",
      signal: "Mapa pilota online",
    },
    mode: {
      hunt: "Mapa",
      collection: "Kolekcja",
      rewards: "Nagrody",
      collectionCta: "Zobacz kolekcję",
      lockedHint:
        "Zablokowane wersy odblokujesz po potwierdzonym namierzeniu sygnału w aktywnej strefie.",
    },
  },
} satisfies Record<AreaLang, Record<string, unknown>>
