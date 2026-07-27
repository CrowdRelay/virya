export const useMerchImages = () =>
  new Proxy(
    {},
    { get: (_, key) => (typeof key === "string" ? `/images/${key}` : undefined) }
  )
