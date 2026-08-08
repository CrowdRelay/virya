const merchImages = new Proxy(
  {},
  {
    get: (_, key) =>
      typeof key === "string"
        ? key.startsWith("/")
          ? key
          : `/images/${key}`
        : undefined,
  },
)

export const useMerchImages = () => merchImages
