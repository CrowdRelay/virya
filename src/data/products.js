export const CURRENCY = "pln"
export const SHIPPING_PLN = 15
export const SIZES = ["S", "M", "L", "XL", "XXL"]

export const PRODUCTS = [
  {
    id: "echoes",
    name: "Echoes Of The Modern Mind",
    type: "album",
    price: 50,
    front: "merch/echoes.webp",
    back: null,
    sizes: null,
    blurb:
      "Our debut full-length — 11 tracks through the broad mind of a modern man.",
  },
  {
    id: "ashes-color",
    name: "From The Ashes — Colour Tee",
    type: "shirt",
    price: 70,
    front: "merch/Ashes Color Front.webp",
    back: "merch/ashes and wave back.webp",
    sizes: SIZES,
    blurb: "All-over print. The phoenix rises in full colour.",
  },
  {
    id: "ashes-bw",
    name: "From The Ashes — Mono Tee",
    type: "shirt",
    price: 70,
    front: "merch/Ashes BW Front.webp",
    back: "merch/ashes and wave back.webp",
    sizes: SIZES,
    blurb: "All-over print. The phoenix, rendered in monochrome.",
  },
  {
    id: "wave",
    name: "Wave Of Uncertainty Tee",
    type: "shirt",
    price: 70,
    front: "merch/Wave Front.webp",
    back: "merch/ashes and wave back.webp",
    sizes: SIZES,
    blurb: "All-over print. Ride the wave of uncertainty.",
  },
  {
    id: "virya-logo",
    name: "Virya Logo Tee",
    type: "shirt",
    price: 60,
    front: "merch/virya shirt 1.webp",
    back: "merch/virya shirt front.webp",
    sizes: SIZES,
    blurb: "Clean silver crest on the front, gold emblem on the back.",
  },
  {
    id: "bag",
    name: "Virya Tote Bag",
    type: "bag",
    price: 50,
    front: "merch/Bag 1.webp",
    back: "merch/Bag 2.webp",
    sizes: null,
    blurb: "Heavy-duty tote with the Virya crest. Carry the catharsis.",
  },
]

export const getProduct = id => PRODUCTS.find(p => p.id === id)

export const productRequiresShipping = product =>
  !!product && product.requiresShipping !== false

export const toMinorUnits = pln => Math.round(pln * 100)
