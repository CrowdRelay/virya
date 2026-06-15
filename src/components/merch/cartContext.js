"use client"
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react"
import {
  getProduct,
  SHIPPING_PLN,
  productRequiresShipping,
} from "../../data/products"

const STORAGE_KEY = "virya-cart-v1"
const CartContext = createContext(null)

const lineKey = (id, size) => (size ? `${id}::${size}` : id)

const readStored = () => {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(l => getProduct(l.id)) : []
  } catch {
    return []
  }
}

export const CartProvider = ({ children }) => {
  const [lines, setLines] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setLines(readStored())
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
    }
  }, [lines])

  const add = useCallback((id, size = null, qty = 1) => {
    const product = getProduct(id)
    if (!product) return
    setLines(prev => {
      const key = lineKey(id, size)
      const existing = prev.find(l => lineKey(l.id, l.size) === key)
      if (existing) {
        return prev.map(l =>
          lineKey(l.id, l.size) === key ? { ...l, qty: l.qty + qty } : l
        )
      }
      return [...prev, { id, size, qty }]
    })
    setOpen(true)
  }, [])

  const setQty = useCallback((id, size, qty) => {
    setLines(prev =>
      qty <= 0
        ? prev.filter(l => lineKey(l.id, l.size) !== lineKey(id, size))
        : prev.map(l =>
            lineKey(l.id, l.size) === lineKey(id, size) ? { ...l, qty } : l
          )
    )
  }, [])

  const remove = useCallback((id, size) => {
    setLines(prev =>
      prev.filter(l => lineKey(l.id, l.size) !== lineKey(id, size))
    )
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const detailed = useMemo(
    () =>
      lines
        .map(l => {
          const product = getProduct(l.id)
          if (!product) return null
          return { ...l, product, lineTotal: product.price * l.qty }
        })
        .filter(Boolean),
    [lines]
  )

  const count = useMemo(
    () => detailed.reduce((n, l) => n + l.qty, 0),
    [detailed]
  )
  const subtotal = useMemo(
    () => detailed.reduce((s, l) => s + l.lineTotal, 0),
    [detailed]
  )
  const needsShipping = useMemo(
    () => detailed.some(l => productRequiresShipping(l.product)),
    [detailed]
  )
  const shipping = needsShipping ? SHIPPING_PLN : 0
  const total = subtotal + shipping

  const value = useMemo(
    () => ({
      lines: detailed,
      count,
      subtotal,
      shipping,
      needsShipping,
      total,
      open,
      setOpen,
      add,
      setQty,
      remove,
      clear,
    }),
    [
      detailed,
      count,
      subtotal,
      shipping,
      needsShipping,
      total,
      open,
      add,
      setQty,
      remove,
      clear,
    ]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within a CartProvider")
  return ctx
}

export { lineKey }
