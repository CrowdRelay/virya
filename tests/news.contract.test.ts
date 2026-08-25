import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { newsPosts } from "../src/data/news.ts"

const root = fileURLToPath(new URL("../", import.meta.url))
const read = (path: string) => readFileSync(`${root}${path}`, "utf8")

// Structural guarantees only: the posts' wording and dates are editorial
// content and change legitimately; what must hold is that every post is
// bilingual, substantive and backed by an image that actually ships.
test("every news post is bilingual, substantive and image-backed", () => {
  assert.ok(newsPosts.length > 0)
  for (const post of newsPosts) {
    assert.ok(post.title.pl.length > 0)
    assert.ok(post.title.en.length > 0)
    assert.ok(post.excerpt.pl.length > 0)
    assert.ok(post.excerpt.en.length > 0)
    assert.ok(post.body.pl.length >= 2)
    assert.ok(post.body.en.length >= 2)
    assert.ok(post.image.startsWith("/images/"))
    assert.ok(existsSync(`${root}public${post.image}`), `missing ${post.image}`)
  }
})

// newsPosts is the single canonical ordering point (sorted newest-first in
// src/data/news.ts); this guards that the exported accessor stays sorted even
// when new entries are appended with misdated publishedAt values.
test("news feed is ordered newest-first regardless of authoring order", () => {
  for (let index = 1; index < newsPosts.length; index += 1) {
    const previous = newsPosts[index - 1].publishedAt
    const current = newsPosts[index].publishedAt
    assert.ok(
      previous.localeCompare(current) >= 0,
      `expected "${previous}" >= "${current}" at positions ${index - 1}/${index}`,
    )
  }
})

test("news has static bilingual index and detail routes", () => {
  assert.match(read("src/pages/news.astro"), /NewsIndexPage lang="en"/)
  assert.match(read("src/pages/pl/news.astro"), /NewsIndexPage lang="pl"/)
  assert.match(read("src/pages/news/[slug].astro"), /getStaticPaths/)
  assert.match(read("src/pages/pl/news/[slug].astro"), /getStaticPaths/)
})

test("Latarnik surfaces the public briefing without changing its auth flow", () => {
  const portal = read("src/components/LatarnikPage.astro")
  assert.match(portal, /id="aktualnosci"/)
  assert.match(portal, /newsPosts\.slice\(0, 3\)/)
  assert.match(portal, /Aktualności VIRYA/)
  assert.match(portal, /beacon\/invitations\/exchange/)
  assert.match(portal, /virya-beacon-session-v1/)
})
