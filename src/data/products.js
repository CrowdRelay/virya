export const CURRENCY = "pln"
export const SHIPPING_PLN = 15
export const SIZES = ["S", "M", "L", "XL", "XXL"]

// Approximate unisex tee measurements in cm. Standard fit — verify against a
// real garment before publishing as exact. chest = full circumference, flat ×2.
export const SIZE_CHART = [
  { size: "S", chest: 96, length: 71 },
  { size: "M", chest: 104, length: 74 },
  { size: "L", chest: 112, length: 76 },
  { size: "XL", chest: 120, length: 79 },
  { size: "XXL", chest: 128, length: 81 },
]

export const VAT_RATE = 0.23
export const DISCOUNT_RATE = 0.2
export const BUNDLE_DISCOUNT_RATE = 0.3

export const DISCOUNT_FROM = null
export const DISCOUNT_UNTIL = "2026-12-31T23:59:59+01:00"

export const discountActive = (now = new Date()) => {
  if (!(DISCOUNT_RATE > 0)) return false
  if (DISCOUNT_FROM && now < new Date(DISCOUNT_FROM)) return false
  if (DISCOUNT_UNTIL && now > new Date(DISCOUNT_UNTIL)) return false
  return true
}

export const discountEndsAt = () => (DISCOUNT_UNTIL ? new Date(DISCOUNT_UNTIL) : null)

export const discountEndsLabel = (locale = "en-GB") => {
  const d = discountEndsAt()
  if (!d || !discountActive()) return null
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export const PRODUCTS = [
  {
    id: "echoes",
    name: "Echoes Of The Modern Mind",
    name_pl: "Echoes Of The Modern Mind",
    type: "album",
    price: 50,
    front: "merch/echoes.webp",
    back: "merch/echoesback.webp",
    sizes: null,
    inStock: true,
    blurb:
      "Our debut full-length — 11 tracks through the broad mind of a modern man. Every piece is signed by the band.",
    blurb_pl:
      "Nasz debiutancki album — 11 utworów przez szeroki umysł współczesnego człowieka. Każdy egzemplarz sygnowany przez zespół.",
  },
  {
    id: "ashes-color",
    name: "From The Ashes — Colour Tee",
    name_pl: "From The Ashes — Koszulka (kolor)",
    name_pl: "From The Ashes — Koszulka Kolorowa",
    type: "shirt",
    price: 70,
    front: "merch/Ashes Color Front.webp",
    back: "merch/back.webp",
    sizes: SIZES,
    inStockSizes: ["M"],
    lowStock: true,
    lowStockSizes: ["M"],
    blurb: "All-over print. The phoenix rises in full colour.",
    blurb_pl: "Nadruk all-over. Feniks powstaje w pełnym kolorze.",
  },
  {
    id: "ashes-bw",
    name: "From The Ashes — Mono Tee",
    name_pl: "From The Ashes — Koszulka (mono)",
    name_pl: "From The Ashes — Koszulka monochrom",
    type: "shirt",
    price: 70,
    front: "merch/Ashes BW Front.webp",
    back: "merch/back.webp",
    sizes: SIZES,
    inStockSizes: ["M", "L"],
    lowStockSizes: ["L"],
    blurb: "All-over print. The phoenix, rendered in monochrome.",
    blurb_pl: "Nadruk all-over. Feniks w monochromatycznej odsłonie.",
  },
  {
    id: "wave",
    name: "Wave Of Uncertainty Tee",
    name_pl: "Wave Of Uncertainty — Koszulka",
    name_pl: "Fala Niepewności — Koszulka",
    type: "shirt",
    price: 70,
    front: "merch/Wave Front.webp",
    back: "merch/back.webp",
    sizes: SIZES,
    inStockSizes: ["M", "L", "XL"],
    lowStockSizes: ["XL"],
    blurb: "All-over print. Ride the wave of uncertainty.",
    blurb_pl: "Nadruk all-over. Płyń na fali niepewności.",
  },
  {
    id: "virya-logo",
    name: "Virya Logo Tee",
    name_pl: "Koszulka Virya Logo",
    name_pl: "Koszulka z Logo Viryi",
    type: "shirt",
    price: 60,
    front: "merch/virya shirt 1.webp",
    back: "merch/virya shirt 2.webp",
    sizes: SIZES,
    inStockSizes: ["S", "L", "XXL"],
    lowStockSizes: ["XXL"],
    blurb: "Clean silver crest on the front, gold emblem on the back.",
    blurb_pl: "Czysty srebrny herb z przodu, złoty emblemat z tyłu.",
  },
  {
    id: "bag",
    name: "Virya Tote Bag",
    name_pl: "Torba Virya",
    name_pl: "Torba Viryi",
    type: "bag",
    price: 50,
    front: "merch/Bag 1.webp",
    back: "merch/Bag 2.webp",
    sizes: null,
    inStock: true,
    blurb: "Heavy-duty tote with the Virya crest. Carry the catharsis.",
    blurb_pl: "Wytrzymała torba z herbem Viryi. Noś katharsis ze sobą.",
  },
]

export const BUNDLES = [
  {
    id: "bundle-stage-pack",
    name: "Stage Pack",
    name_pl: "Pakiet Sceniczny",
    type: "bundle",
    bundle: true,
    price: 100,
    front: "merch/virya shirt 1.webp",
    back: "merch/echoes.webp",
    sizes: SIZES,
    inStockSizes: ["S", "L", "XXL"],
    lowStockSizes: ["XXL"],
    includes: ["Virya Logo Tee", "Echoes — CD album"],
    includes_pl: ["Koszulka Virya Logo", "Echoes — album CD"],
    blurb: "The logo tee and our debut album together — cheaper than apart.",
    blurb_pl: "Koszulka z logo i debiutancki album razem — taniej niż osobno.",
  },
  {
    id: "bundle-catharsis-pack",
    name: "Catharsis Pack",
    name_pl: "Pakiet Catharsis",
    type: "bundle",
    bundle: true,
    price: 90,
    front: "merch/Bag 1.webp",
    back: "merch/echoes.webp",
    sizes: null,
    inStock: true,
    includes: ["Virya Tote Bag", "Echoes — CD album"],
    includes_pl: ["Torba Virya", "Echoes — album CD"],
    blurb: "Carry the catharsis: the tote plus the debut album in one pack.",
    blurb_pl: "Noś katharsis: torba i debiutancki album w jednym zestawie.",
  },
  {
    id: "bundle-stay-mad-pack",
    name: "Stay Mad Pack",
    name_pl: "Pakiet Stay Mad",
    type: "bundle",
    bundle: true,
    price: 100,
    front: "merch/virya shirt 1.webp",
    back: "merch/Bag 1.webp",
    sizes: SIZES,
    inStockSizes: ["S", "L", "XXL"],
    lowStockSizes: ["XXL"],
    includes: ["Virya Logo Tee", "Virya Tote Bag"],
    blurb: "The logo tee and tote together — wear it, carry it, Stay Mad.",
    blurb_pl: "Koszulka z logo i torba razem — ubierz, noś, Stay Mad.",
  },
]

export const ALL_PRODUCTS = [...PRODUCTS, ...BUNDLES]

export const getProduct = id => ALL_PRODUCTS.find(p => p.id === id)

export const isBundle = product => !!product && product.bundle === true

export const discountRate = product =>
  isBundle(product) ? BUNDLE_DISCOUNT_RATE : DISCOUNT_RATE

export const discountPct = product =>
  discountActive() ? Math.round(discountRate(product) * 100) : 0

export const productLowStock = product =>
  !!product && product.lowStock === true && productInStock(product)

export const sizeLowStock = (product, size) =>
  !!product &&
  Array.isArray(product.lowStockSizes) &&
  product.lowStockSizes.includes(size) &&
  sizeInStock(product, size)

export const productRequiresShipping = product =>
  !!product && product.requiresShipping !== false

export const discountedPrice = product => {
  if (!product) return 0
  if (!discountActive()) return product.price
  return Math.round(product.price * (1 - discountRate(product)))
}

export const sizeInStock = (product, size) => {
  if (!product || !Array.isArray(product.inStockSizes)) return true
  return product.inStockSizes.includes(size)
}

export const productInStock = product => {
  if (!product) return false
  if (Array.isArray(product.sizes)) {
    return (
      Array.isArray(product.inStockSizes) && product.inStockSizes.length > 0
    )
  }
  return product.inStock !== false
}

export const vatBreakdown = (gross, rate = VAT_RATE) => {
  const net = gross / (1 + rate)
  return { gross, net, vat: gross - net }
}

export const toMinorUnits = pln => Math.round(pln * 100)
