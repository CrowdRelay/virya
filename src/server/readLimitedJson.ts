import { readLimitedBytes } from "./readLimitedBody.ts"

type ErrorFactory = () => Error

const defaultError = () => new Error("Upstream JSON response is invalid or too large")

export async function readLimitedJson<T>(
  response: Response,
  maxBytes: number,
  errorFactory: ErrorFactory = defaultError,
): Promise<T> {
  const body = await readLimitedBytes(response, maxBytes, errorFactory)

  if (body.byteLength === 0) throw errorFactory()
  try {
    return JSON.parse(new TextDecoder().decode(body)) as T
  } catch {
    throw errorFactory()
  }
}
