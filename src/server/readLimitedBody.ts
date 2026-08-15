type ErrorFactory = () => Error

export class BodyTooLargeError extends Error {
  constructor(message = "Body exceeds byte budget") {
    super(message)
    this.name = "BodyTooLargeError"
  }
}

const defaultError = () => new Error("Upstream response is too large")

export async function readLimitedBytes(
  response: Request | Response,
  maxBytes: number,
  errorFactory: ErrorFactory = defaultError,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError("maxBytes must be a positive safe integer")
  }

  const declaredRaw = response.headers.get("content-length")
  if (declaredRaw !== null) {
    const declaredLength = Number(declaredRaw)
    if (
      !Number.isSafeInteger(declaredLength) ||
      declaredLength < 0 ||
      declaredLength > maxBytes
    ) {
      throw errorFactory()
    }
  }

  if (!response.body) return new Uint8Array()

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel("upstream response exceeded byte budget")
        } catch {
          // Cancellation is best-effort; the size violation still fails closed.
        }
        throw errorFactory()
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

export async function readLimitedText(
  value: Request | Response,
  maxBytes: number,
): Promise<string> {
  const bytes = await readLimitedBytes(
    value,
    maxBytes,
    () => new BodyTooLargeError(),
  )
  return new TextDecoder().decode(bytes)
}
