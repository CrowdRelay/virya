import type { Lang } from "../i18n/t"

export interface SignalCopy {
  meta: {
    title: string
    description: string
  }
  hero: {
    eyebrow: string
    heading: string
    body: string
    primary: string
    secondary: string
    account: string
    status: string
  }
  promise: {
    eyebrow: string
    heading: string
    body: string
    steps: Array<{ number: string; title: string; body: string; href: string; cta: string }>
  }
  form: {
    eyebrow: string
    heading: string
    body: string
    email: string
    nickname: string
    city: string
    cityPlaceholder: string
    consent: string
    privacy: string
    submit: string
    saving: string
    loadingCities: string
    loadError: string
    validationError: string
    saveError: string
    pendingTitle: string
    pendingBody: string
    recoveryBody: string
    cooldownBody: (minutes: number) => string
    acceptedBody: string
    savedTitle: string
    savedBody: string
    referralTitle: string
    copy: string
    copied: string
    goAccount: string
  }
  cities: {
    eyebrow: string
    heading: string
    body: string
    loading: string
    unavailable: string
    empty: string
    people: (count: number) => string
  }
  events: {
    eyebrow: string
    heading: string
    body: string
    loading: string
    unavailable: string
    empty: string
    details: string
    tickets: string
    calendar: string
    listen: string
  }
  area: {
    eyebrow: string
    heading: string
    body: string
    cta: string
    merch: string
  }
  areaBridge: {
    heading: string
    body: string
    signal: string
    merch: string
  }
  account: {
    metaTitle: string
    eyebrow: string
    heading: string
    body: string
    loading: string
    unauthorizedTitle: string
    unauthorizedBody: string
    join: string
    referrals: string
    qualified: string
    pending: string
    nextReward: (threshold: number) => string
    allUnlocked: string
    copyLink: string
    linkCopied: string
    draws: string
    noDraws: string
    drawEntries: (count: number) => string
    drawReferrals: (count: number) => string
    drawCheckins: (count: number) => string
    drawCloses: string
    drawAt: string
    rewards: string
    noRewards: string
    physicalReward: string
    rewardExpires: string
    rewardStatus: Record<"issued" | "fulfilled" | "expired" | "revoked", string>
    useInStore: string
    concerts: string
    noConcerts: string
    openArea: string
    openStore: string
  }
  action: {
    confirmTitle: string
    confirmWorking: string
    confirmSuccess: string
    confirmError: string
    unsubscribeTitle: string
    unsubscribeWorking: string
    unsubscribeSuccess: string
    unsubscribeError: string
    missingToken: string
    account: string
    home: string
  }
  event: {
    loading: string
    unavailable: string
    back: string
    interest: string
    interestWorking: string
    interestSaved: string
    interestLogin: string
    checkinWorking: string
    checkinSuccess: string
    checkinAlready: string
    checkinLogin: string
    checkinExpired: string
    checkinFull: string
    checkinError: string
    checkinBonus: string
    checkinJoin: string
    share: string
    shared: string
    tickets: string
    listen: string
    calendar: string
    venue: string
  }
  teaser: {
    eyebrow: string
    heading: string
    body: string
    primary: string
    area: string
    merch: string
    chips: string[]
  }
  manager: {
    eyebrow: string
    heading: string
    body: string
    points: Array<{ title: string; body: string }>
    signal: string
    area: string
  }
}

export const SIGNAL_COPY: Record<Lang, SignalCopy> = {
  en: {
    meta: {
      title: "Virya Signal — fan rewards, shows and AREA",
      description:
        "Join Virya Signal, choose your city, play VIRYA Area, unlock merch rewards and follow upcoming shows in one fan ecosystem.",
    },
    hero: {
      eyebrow: "VIRYA // SIGNAL",
      heading: "One signal. The whole Virya world.",
      body:
        "Tell us where you are, discover AREA drops, unlock rewards, follow shows and bring friends into the signal. Music stays at the centre — the system makes being part of it more rewarding.",
      primary: "Activate my signal",
      secondary: "Explore AREA",
      account: "My Signal",
      status: "Live · privacy-first · built by Virya",
    },
    promise: {
      eyebrow: "How it connects",
      heading: "From listener to part of the story",
      body:
        "Virya Signal connects the music, the city map, rewards, merch and live shows without turning the site into a heavy app.",
      steps: [
        {
          number: "01",
          title: "Choose your city",
          body: "Join the owned Virya community and help us see where the signal is strongest.",
          href: "#join-signal",
          cta: "Join",
        },
        {
          number: "02",
          title: "Play AREA",
          body: "Find live drops, recover collectible transmissions and earn AREA Credits.",
          href: "/area/",
          cta: "Open map",
        },
        {
          number: "03",
          title: "Unlock merch",
          body: "Turn AREA Credits and referral milestones into real benefits in the Virya store.",
          href: "/merch/",
          cta: "Open store",
        },
        {
          number: "04",
          title: "Return live",
          body: "Follow shows, save dates and scan a venue QR. Event-specific guest-list draws stay separate, while each concert check-in strengthens one global draw for three physical albums.",
          href: "#signal-shows",
          cta: "See shows",
        },
      ],
    },
    form: {
      eyebrow: "Activate",
      heading: "Start your Virya Signal",
      body:
        "One email and one city. We use it to send relevant Virya updates, not generic noise.",
      email: "Email",
      nickname: "Name or nickname (optional)",
      city: "Your city",
      cityPlaceholder: "Choose a city",
      consent:
        "I want to receive Virya news, show alerts and reward updates. I can unsubscribe at any time.",
      privacy: "Your data stays with Virya and is never sold to advertisers.",
      submit: "Activate signal",
      saving: "Activating…",
      loadingCities: "Loading cities…",
      loadError: "Cities are temporarily unavailable. Try again in a moment.",
      validationError: "Enter an email, choose a city and accept the consent.",
      saveError: "We could not activate the signal. Check the data and try again.",
      pendingTitle: "Check your inbox",
      pendingBody:
        "We sent a confirmation message. Confirm the address to activate your private Signal session and referral link.",
      recoveryBody:
        "We sent a secure access link for your existing Virya Signal profile.",
      cooldownBody: (minutes) =>
        `A new message was not sent because the previous code is still valid. Use the previous email or try again in about ${minutes} min.`,
      acceptedBody:
        "Your request was accepted. Check your inbox and spam; if nothing arrives, try again later.",
      savedTitle: "Signal active",
      savedBody: "Your city, shows and referral progress now live in one place.",
      referralTitle: "Your referral link",
      copy: "Share Signal",
      copied: "Copied",
      goAccount: "Open My Signal",
    },
    cities: {
      eyebrow: "City demand",
      heading: "Where the signal is growing",
      body:
        "Every confirmed fan strengthens their city. This helps us prioritise routing, local campaigns and future shows.",
      loading: "Loading city signals…",
      unavailable: "City signals are temporarily unavailable.",
      empty: "The first city signals will appear here.",
      people: count => `${count} ${count === 1 ? "person" : "people"}`,
    },
    events: {
      eyebrow: "Live layer",
      heading: "Follow the next transmissions",
      body:
        "Open a show page, save the date and register interest. Selected events can have separate guest-list draws; a valid venue QR confirms attendance and adds an entry to one global draw for three physical Virya albums.",
      loading: "Loading shows…",
      unavailable: "Shows are temporarily unavailable.",
      empty: "New shows will appear here.",
      details: "Show details",
      tickets: "Tickets",
      calendar: "Calendar",
      listen: "Listen",
    },
    area: {
      eyebrow: "Game layer",
      heading: "AREA turns attention into a real adventure",
      body:
        "Signal gives you continuity. AREA gives you the hunt: physical locations, collectible lines, community progress and rewards that lead straight into the merch store.",
      cta: "Enter AREA",
      merch: "Use rewards in merch",
    },
    areaBridge: {
      heading: "Keep the signal after the AREA drop",
      body:
        "Your AREA reward stays in the AREA wallet. Activate Virya Signal to connect your city, show alerts, referrals and future limited rewards without slowing down the game.",
      signal: "Connect with Virya Signal",
      merch: "Open merch",
    },
    account: {
      metaTitle: "My Virya Signal",
      eyebrow: "Private fan space",
      heading: "My Signal",
      body:
        "Your referrals, rewards and followed shows — without a password and without a heavy dashboard.",
      loading: "Loading your Signal…",
      unauthorizedTitle: "Your Signal is not active in this browser",
      unauthorizedBody:
        "Join or confirm your email first. The private session is stored in a secure HttpOnly cookie.",
      join: "Activate Signal",
      referrals: "Referral pulse",
      qualified: "Confirmed",
      pending: "Pending",
      nextReward: threshold => `Next reward at ${threshold} confirmed referrals.`,
      allUnlocked: "All currently available referral rewards are unlocked.",
      copyLink: "Share Signal",
      linkCopied: "Referral link copied",
      draws: "Active draws",
      noDraws: "There are no active draws right now. Your referrals remain counted for future actions.",
      drawEntries: count => `${count} ${count === 1 ? "entry" : "entries"}`,
      drawReferrals: count => `${count} confirmed ${count === 1 ? "referral" : "referrals"}`,
      drawCheckins: count => `${count} concert ${count === 1 ? "check-in" : "check-ins"}`,
      drawCloses: "Entries close",
      drawAt: "Draw",
      rewards: "Rewards",
      noRewards: "No rewards have been issued yet. AREA rewards stay visible inside AREA.",
      physicalReward: "Physical prize",
      rewardExpires: "Claim by",
      rewardStatus: {
        issued: "Ready to claim",
        fulfilled: "Fulfilled",
        expired: "Expired",
        revoked: "Cancelled",
      },
      useInStore: "Use in store",
      concerts: "Followed shows",
      noConcerts: "You are not following any shows yet.",
      openArea: "Open AREA wallet",
      openStore: "Open merch",
    },
    action: {
      confirmTitle: "Activating your Signal",
      confirmWorking: "Confirming the address…",
      confirmSuccess: "Signal active. Your private fan session is ready.",
      confirmError: "This confirmation link is invalid or has expired.",
      unsubscribeTitle: "Signal preferences",
      unsubscribeWorking: "Updating preferences…",
      unsubscribeSuccess: "You have been unsubscribed from Virya messages.",
      unsubscribeError: "This unsubscribe link is invalid or has expired.",
      missingToken: "The secure token is missing from this link.",
      account: "Open My Signal",
      home: "Back to Virya",
    },
    event: {
      loading: "Loading show…",
      unavailable: "This show is unavailable or has not been published yet.",
      back: "All Signal shows",
      interest: "Follow this show",
      interestWorking: "Saving…",
      interestSaved: "Saved. We will keep this show in your Signal.",
      interestLogin: "Activate or confirm Signal first to follow shows.",
      checkinWorking: "Confirming your concert check-in…",
      checkinSuccess: "Presence confirmed. This concert now counts towards the global three-album draw.",
      checkinAlready: "Your presence at this concert was already confirmed.",
      checkinLogin: "Activate or confirm Virya Signal to finish this concert check-in.",
      checkinExpired: "This concert QR is inactive, expired or has been revoked.",
      checkinFull: "This limited QR campaign has reached its check-in limit.",
      checkinError: "We could not confirm the check-in. Keep this page open and try again.",
      checkinBonus: "Concert check-in",
      checkinJoin: "Activate Signal",
      share: "Share",
      shared: "Shared",
      tickets: "Tickets",
      listen: "Listen",
      calendar: "Add to calendar",
      venue: "Venue",
    },
    teaser: {
      eyebrow: "VIRYA // SIGNAL",
      heading: "The music has its own fan operating system",
      body:
        "Choose your city, play AREA, unlock merch benefits, follow shows and build referral progress — in one fast, privacy-first experience built by the band.",
      primary: "Activate Signal",
      area: "Play AREA",
      merch: "Open merch",
      chips: ["City demand", "AREA rewards", "Album draws", "Merch loop", "Referrals"],
    },
    manager: {
      eyebrow: "Fan infrastructure",
      heading: "A professional band with an owned growth engine",
      body:
        "Virya combines a release-ready live act with first-party fan acquisition, geolocation engagement, merch conversion and automated event communication.",
      points: [
        {
          title: "Owned audience",
          body: "Consent-based city and fan data instead of dependence on social reach.",
        },
        {
          title: "Measurable activation",
          body: "Tracked campaigns, referrals, show interest, limited album draws and merch reward redemption.",
        },
        {
          title: "Original fan product",
          body: "AREA, concert QR pools and merch form one measurable fan journey instead of isolated promotions.",
        },
        {
          title: "Automation-ready",
          body: "Reliable Rust backend, transactional events and n8n-ready workflows.",
        },
      ],
      signal: "Open Virya Signal",
      area: "See VIRYA Area",
    },
  },
  pl: {
    meta: {
      title: "Sygnał Virya — koncerty, nagrody i gra terenowa",
      description:
        "Dołącz do Sygnału Virya, wybierz miasto, obserwuj koncerty, zdobywaj dodatkowe losy za polecenia i graj w terenową Grę Virya.",
    },
    hero: {
      eyebrow: "VIRYA // SYGNAŁ",
      heading: "Koncerty blisko Ciebie. Bilety i nagrody w jednym miejscu.",
      body:
        "Podaj e-mail i miasto. Dostaniesz tylko ważne informacje o koncertach, premierach i aktywnych akcjach Viryi. Po zapisie od razu zobaczysz swój następny krok.",
      primary: "Dołącz do Sygnału",
      secondary: "Otwórz Grę Virya",
      account: "Mój Sygnał",
      status: "Działa · prywatność przede wszystkim · zbudowane przez Viryę",
    },
    promise: {
      eyebrow: "Co możesz zrobić dalej",
      heading: "Jedno konto. Kilka niezależnych możliwości.",
      body:
        "Nie musisz korzystać ze wszystkiego. Sygnał zapisuje Twoje miasto i daje link polecający. Gra terenowa działa osobno, a koncertowe QR-y otwierają dodatkowe, limitowane pule nagród.",
      steps: [
        {
          number: "01",
          title: "Dołącz do Sygnału",
          body: "Podaj e-mail i miasto. Po potwierdzeniu dostaniesz prywatny link polecający i dostęp do koncertowych akcji.",
          href: "#join-signal",
          cta: "Dołącz",
        },
        {
          number: "02",
          title: "Zagraj w Grę Virya",
          body: "Wybierz aktywne miasto, idź za wskazówką i potwierdź lokalizację, aby odebrać nagrodę.",
          href: "/pl/area/",
          cta: "Otwórz mapę",
        },
        {
          number: "03",
          title: "Odbierz nagrodę kampanii",
          body: "Po znalezieniu aktywnej strefy zobaczysz w portfelu dokładną nagrodę i warunki jej użycia. Nie musisz zbierać wszystkich punktów w Polsce.",
          href: "/pl/merch/",
          cta: "Otwórz sklep",
        },
        {
          number: "04",
          title: "Skanuj QR na koncertach",
          body: "Na koncercie zeskanuj QR i potwierdź obecność. Wejściówki mają osobne pule wydarzeń, a każdy check-in zwiększa szansę w jednej globalnej puli trzech płyt.",
          href: "#signal-shows",
          cta: "Zobacz koncerty",
        },
      ],
    },
    form: {
      eyebrow: "Aktywacja",
      heading: "Dołącz do Sygnału Virya",
      body:
        "Trzy krótkie kroki: kontakt, miasto i zgoda. Po potwierdzeniu adresu dostaniesz swój Sygnał oraz jasną informację, co możesz zrobić dalej.",
      email: "E-mail",
      nickname: "Imię lub nick (opcjonalnie)",
      city: "Twoje miasto",
      cityPlaceholder: "Wybierz miasto",
      consent:
        "Chcę otrzymywać informacje o Viryi, koncertach i nagrodach. Mogę wypisać się w każdej chwili.",
      privacy: "Twoje dane zostają u Viryi i nigdy nie są sprzedawane reklamodawcom.",
      submit: "Dołącz do Sygnału",
      saving: "Aktywuję…",
      loadingCities: "Ładuję miasta…",
      loadError: "Lista miast jest chwilowo niedostępna. Spróbuj ponownie za moment.",
      validationError: "Podaj e-mail, wybierz miasto i zaakceptuj zgodę.",
      saveError: "Nie udało się aktywować sygnału. Sprawdź dane i spróbuj ponownie.",
      pendingTitle: "Sprawdź skrzynkę",
      pendingBody:
        "Wysłaliśmy wiadomość potwierdzającą. Potwierdź adres, aby aktywować prywatny Sygnał i link polecający.",
      recoveryBody:
        "Wysłaliśmy bezpieczny link dostępu do Twojego istniejącego profilu Virya Signal.",
      cooldownBody: (minutes) =>
        `Nowa wiadomość nie została wysłana, bo poprzedni kod jest jeszcze ważny. Użyj poprzedniego maila albo spróbuj ponownie za około ${minutes} min.`,
      acceptedBody:
        "Zgłoszenie zostało przyjęte. Sprawdź skrzynkę i spam; jeśli nic nie dotrze, spróbuj ponownie później.",
      savedTitle: "Sygnał aktywny",
      savedBody: "Miasto, koncerty i postęp poleceń masz teraz w jednym miejscu.",
      referralTitle: "Twój link polecający",
      copy: "Udostępnij Sygnał",
      copied: "Skopiowano",
      goAccount: "Otwórz Mój Sygnał",
    },
    cities: {
      eyebrow: "Popyt w miastach",
      heading: "Gdzie rośnie sygnał",
      body:
        "Miasto pomaga nam wysyłać właściwe alerty i planować koncerty. Małych liczb nie pokazujemy — ważny jest kierunek, nie ranking ludzi.",
      loading: "Ładuję sygnały miast…",
      unavailable: "Sygnały miast są chwilowo niedostępne.",
      empty: "Pierwsze sygnały miast pojawią się tutaj.",
      people: count => `${count} ${count === 1 ? "osoba" : count < 5 ? "osoby" : "osób"}`,
    },
    events: {
      eyebrow: "Koncerty i pule nagród",
      heading: "Patrz, gdzie niedługo gramy",
      body:
        "Wybierz koncert, sprawdź miejsce i zapisz datę. Wybrane wydarzenia mogą mieć osobne pule wejściówek, a koncertowy QR potwierdza obecność i dodaje los do jednej globalnej puli trzech płyt.",
      loading: "Ładuję koncerty…",
      unavailable: "Koncerty są chwilowo niedostępne.",
      empty: "Nowe koncerty pojawią się tutaj.",
      details: "Szczegóły koncertu",
      tickets: "Bilety",
      calendar: "Kalendarz",
      listen: "Słuchaj",
    },
    area: {
      eyebrow: "Gra terenowa · działa osobno",
      heading: "Gra Virya: tylko aktywne sygnały w Twoim mieście",
      body:
        "Nie objeżdżasz Polski i nie musisz zebrać 12 punktów. Wybierasz aktualnie aktywne miasto, otwierasz przybliżony punkt startowy, idziesz za wskazówką i potwierdzasz strefę telefonem.",
      cta: "Otwórz Grę Virya",
      merch: "Użyj nagród w sklepie",
    },
    areaBridge: {
      heading: "Połącz nagrodę z Sygnałem Virya",
      body:
        "Nagroda z gry zostaje w portfelu gracza. Dołącz do Sygnału Virya, aby zachować miasto, dostawać alerty koncertowe i zdobywać dodatkowe losy za skuteczne polecenia.",
      signal: "Dołącz do Sygnału Virya",
      merch: "Otwórz merch",
    },
    account: {
      metaTitle: "Mój Sygnał Virya",
      eyebrow: "Prywatna przestrzeń fana",
      heading: "Mój Sygnał",
      body:
        "Polecenia, nagrody i obserwowane koncerty — bez hasła i bez ciężkiego dashboardu.",
      loading: "Ładuję Twój Sygnał…",
      unauthorizedTitle: "Sygnał nie jest aktywny w tej przeglądarce",
      unauthorizedBody:
        "Najpierw dołącz lub potwierdź e-mail. Prywatna sesja jest przechowywana w bezpiecznym cookie HttpOnly.",
      join: "Dołącz do Sygnału",
      referrals: "Puls poleceń",
      qualified: "Potwierdzone",
      pending: "Oczekujące",
      nextReward: threshold => `Kolejna nagroda przy ${threshold} potwierdzonych poleceniach.`,
      allUnlocked: "Wszystkie dostępne teraz nagrody poleceń są odblokowane.",
      copyLink: "Udostępnij Sygnał",
      linkCopied: "Link polecający skopiowany",
      draws: "Aktywne losowania",
      noDraws: "Teraz nie trwa żadne losowanie. Twoje potwierdzone polecenia nadal liczą się do kolejnych akcji.",
      drawEntries: count => `${count} ${count === 1 ? "los" : count < 5 ? "losy" : "losów"}`,
      drawReferrals: count => `${count} ${count === 1 ? "potwierdzone polecenie" : count < 5 ? "potwierdzone polecenia" : "potwierdzonych poleceń"}`,
      drawCheckins: count => `${count} ${count === 1 ? "check-in koncertowy" : count < 5 ? "check-iny koncertowe" : "check-inów koncertowych"}`,
      drawCloses: "Koniec zbierania losów",
      drawAt: "Losowanie",
      rewards: "Nagrody",
      noRewards: "Nie masz jeszcze przyznanych nagród. Nagrody z Gry Virya są widoczne w portfelu gry.",
      physicalReward: "Nagroda fizyczna",
      rewardExpires: "Odbierz do",
      rewardStatus: {
        issued: "Gotowa do odbioru",
        fulfilled: "Zrealizowana",
        expired: "Wygasła",
        revoked: "Anulowana",
      },
      useInStore: "Użyj w sklepie",
      concerts: "Obserwowane koncerty",
      noConcerts: "Nie obserwujesz jeszcze żadnego koncertu.",
      openArea: "Otwórz portfel gry",
      openStore: "Otwórz sklep",
    },
    action: {
      confirmTitle: "Aktywuję Twój Sygnał",
      confirmWorking: "Potwierdzam adres…",
      confirmSuccess: "Sygnał aktywny. Prywatna sesja fana jest gotowa.",
      confirmError: "Ten link potwierdzający jest nieprawidłowy albo wygasł.",
      unsubscribeTitle: "Ustawienia Sygnału",
      unsubscribeWorking: "Aktualizuję ustawienia…",
      unsubscribeSuccess: "Wypisano Cię z wiadomości Viryi.",
      unsubscribeError: "Ten link wypisania jest nieprawidłowy albo wygasł.",
      missingToken: "W tym linku brakuje bezpiecznego tokena.",
      account: "Otwórz Mój Sygnał",
      home: "Wróć do Viryi",
    },
    event: {
      loading: "Ładuję koncert…",
      unavailable: "Ten koncert jest niedostępny albo nie został jeszcze opublikowany.",
      back: "Wszystkie koncerty Sygnału",
      interest: "Obserwuj koncert",
      interestWorking: "Zapisuję…",
      interestSaved: "Zapisano. Ten koncert jest teraz na liście Sygnału Virya.",
      interestLogin: "Najpierw dołącz do Sygnału i potwierdź e-mail, aby obserwować koncerty.",
      checkinWorking: "Potwierdzam obecność na koncercie…",
      checkinSuccess: "Obecność potwierdzona. Ten koncert zwiększa teraz Twoją szansę w jednej globalnej puli trzech płyt.",
      checkinAlready: "Twoja obecność na tym koncercie była już potwierdzona.",
      checkinLogin: "Dołącz do Sygnału Virya albo potwierdź e-mail, aby dokończyć check-in.",
      checkinExpired: "Ten koncertowy QR jest nieaktywny, wygasł albo został wyłączony.",
      checkinFull: "Ta limitowana kampania QR osiągnęła maksymalną liczbę check-inów.",
      checkinError: "Nie udało się potwierdzić obecności. Zostaw tę stronę otwartą i spróbuj ponownie.",
      checkinBonus: "Check-in koncertowy",
      checkinJoin: "Dołącz do Sygnału",
      share: "Udostępnij",
      shared: "Udostępniono",
      tickets: "Bilety",
      listen: "Słuchaj",
      calendar: "Dodaj do kalendarza",
      venue: "Miejsce",
    },
    teaser: {
      eyebrow: "VIRYA // SYGNAŁ",
      heading: "Koncerty, nagrody i polecenia w jednym miejscu",
      body:
        "Wybierz miasto, obserwuj koncerty, zdobywaj dodatkowe losy za polecenia i graj w terenową Grę Virya — bez ciężkiej aplikacji i zbędnego śledzenia.",
      primary: "Dołącz do Sygnału",
      area: "Otwórz Grę Virya",
      merch: "Otwórz sklep",
      chips: ["Koncerty w Twoim mieście", "Dodatkowe losy za polecenia", "Nagrody z gry", "Albumy i wejściówki", "Prywatne konto"],
    },
    manager: {
      eyebrow: "Infrastruktura fanowska",
      heading: "Profesjonalny zespół z własnym silnikiem wzrostu",
      body:
        "Virya łączy gotowy do grania live act z własnym pozyskiwaniem fanów, angażowaniem geolokalizacyjnym, konwersją merchową i automatyczną komunikacją koncertową.",
      points: [
        {
          title: "Własna publiczność",
          body: "Dane fanów i miast oparte na zgodach, zamiast uzależnienia od zasięgów sociali.",
        },
        {
          title: "Mierzalna aktywacja",
          body: "Śledzone kampanie, polecenia, zainteresowanie koncertami i użycie nagród.",
        },
        {
          title: "Oryginalny produkt fana",
          body: "Gra Virya łączy fizyczne lokalizacje, muzyczną historię i realne nagrody w sklepie.",
        },
        {
          title: "Gotowość do automatyzacji",
          body: "Niezawodny backend w Ruście, transakcyjne zdarzenia i workflow gotowe pod n8n.",
        },
      ],
      signal: "Otwórz Sygnał Virya",
      area: "Zobacz Grę Virya",
    },
  },
}
