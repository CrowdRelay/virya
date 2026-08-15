import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("merch deep-link focus and InPost modal restore browser lifecycle state", async () => {
  const merch = await source("src/components/preact/merch/MerchClient.jsx")
  assert.match(merch, /let focusTimer/)
  assert.match(merch, /window\.clearTimeout\(focusTimer\)/)
  assert.match(merch, /card\.isConnected/)

  const inpost = await source("src/components/preact/merch/inpostGeowidget.jsx")
  assert.match(inpost, /const previousOverflow = document\.body\.style\.overflow/)
  assert.match(inpost, /document\.body\.style\.overflow = previousOverflow/)
})

test("admission QR retries only bounded transient failures", async () => {
  const admission = await source("src/components/preact/signal/AdmissionPassCard.tsx")
  assert.match(admission, /transientFailures < 4/)
  assert.match(admission, /error\.status === 0 \|\| error\.status >= 500/)
  assert.match(admission, /Math\.min\(8_000, 1_000 \* 2 \*\* \(transientFailures - 1\)\)/)
  assert.match(admission, /window\.clearTimeout\(timer\)/)
})


test("muted decorative hero does not advertise an empty captions resource", async () => {
  const landing = await source("src/components/Landing.astro")
  assert.match(landing, /muted/)
  assert.match(landing, /aria-hidden="true"/)
  assert.doesNotMatch(landing, /captions_en\.vtt/)
})
