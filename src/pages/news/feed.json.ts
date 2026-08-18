import type { APIRoute } from "astro"
import { newsPosts } from "../../data/news"

export const prerender = true

const MAX_ITEMS = 20
const absolute = (path: string) => new URL(path, "https://virya.music").toString()

export const GET: APIRoute = async () => {
  const items = newsPosts.slice(0, MAX_ITEMS).map(post => ({
    slug: post.slug,
    publishedAt: post.publishedAt,
    tag: post.tag,
    title: post.title,
    summary: post.excerpt,
    imageUrl: absolute(post.image),
    url: {
      pl: absolute(`/pl/news/${post.slug}/`),
      en: absolute(`/news/${post.slug}/`),
    },
  }))
  return new Response(JSON.stringify({ version: 1, items }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
