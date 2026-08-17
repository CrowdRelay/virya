import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { newsPosts } from "../src/data/news.ts"

const root = fileURLToPath(new URL("../", import.meta.url))
const read = (path: string) => readFileSync(`${root}${path}`, "utf8")

const slugs = [
  "marcin-janusinski-wokalista-virya",
  "jesien-2026-najblizsze-koncerty",
  "virya-signal-latarnik",
]

test("news launches with three bilingual, image-backed posts", () => {
  assert.equal(newsPosts.length, 3)
  assert.deepEqual(newsPosts.map(post => post.slug), slugs)
  const shows = newsPosts.find(post => post.slug === "jesien-2026-najblizsze-koncerty")
  assert.ok(shows)
  for (const marker of ["05.09", "11.09", "WrOFF", "17.10", "30.10", "Hradec Králové"]) {
    assert.ok(shows.body.pl.join(" ").includes(marker), `missing show marker ${marker}`)
  }

  for (const post of newsPosts) {
    assert.equal(post.publishedAt, "2026-08-17")
    assert.ok(post.title.pl.length > 10)
    assert.ok(post.title.en.length > 10)
    assert.ok(post.excerpt.pl.length > 20)
    assert.ok(post.excerpt.en.length > 20)
    assert.ok(post.body.pl.length >= 2)
    assert.ok(post.body.en.length >= 2)
    assert.ok(post.image.startsWith("/images/"))
    assert.ok(existsSync(`${root}public${post.image}`), `missing ${post.image}`)
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
  assert.match(portal, /Press Roomie/)
  assert.match(portal, /beacon\/invitations\/exchange/)
  assert.match(portal, /virya-beacon-session-v1/)
})
