import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const source = async (relative: string) => readFile(path.join(root, relative), "utf8")

test("dead webhook clear remains protected server-side and outside normal Staff UI", async () => {
  const ui = await source("src/components/preact/staff/AdminConsoleTabs.tsx")
  const route = await source("src/pages/api/staff/admin/ops/retry.ts")
  assert.doesNotMatch(ui, /Wyczyść dead dostawy|clear_dead_deliveries|dead dostawy/)
  assert.match(route, /isSameOriginRequest/)
  assert.match(route, /operation === "clear_dead_deliveries"/)
  assert.match(route, /admin\/ops\/deliveries\/dead\/clear/)
  assert.match(route, /idempotencyKey/)
})
