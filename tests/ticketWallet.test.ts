import test from "node:test"
import assert from "node:assert/strict"
import { captureTicketToken, loadTicketOrder, storeTicketOrder } from "../src/lib/ticketWallet.ts"

class MemoryStorage {
  values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

const orderId = "018f4f50-1111-7111-8111-111111111111"
const token = "a".repeat(64)

test("wallet storage rejects malformed capabilities", () => {
  const storage = new MemoryStorage()
  Object.assign(globalThis, { window: {}, localStorage: storage })
  storeTicketOrder({ orderId: "bad", token, eventSlug: "event", orderReference: "VRY", lang: "pl", savedAt: 1 })
  assert.equal(storage.values.size, 0)
})

test("fragment capability is captured then removed from the URL", () => {
  const storage = new MemoryStorage()
  let replaced = ""
  Object.assign(globalThis, {
    window: {}, localStorage: storage,
    location: { hash: `#token=${token}`, pathname: `/tickets/${orderId}`, search: "?source=email" },
    history: { replaceState: (_a: unknown, _b: string, value: string) => { replaced = value } },
  })
  assert.equal(captureTicketToken(orderId), token)
  assert.equal(replaced, `/tickets/${orderId}?source=email`)
  assert.equal(loadTicketOrder(orderId)?.token, token)
})
