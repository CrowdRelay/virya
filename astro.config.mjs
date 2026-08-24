import { defineConfig } from "astro/config"
import preact from "@astrojs/preact"
import netlify from "@astrojs/netlify"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"

const SITEMAP_EXCLUDED_PATHS = new Set([
  "/merch/success",
  "/merch/cancel",
  "/pl/merch/success",
  "/pl/merch/cancel",
  "/thomann",
  "/pl/thomann",
  // Remove these two entries when the first real news post is published.
  "/news",
  "/pl/news",
])

export default defineConfig({
  site: "https://www.virya.music",
  output: "server",
  adapter: netlify(),
  // Public pages are static-first. Astro's global prefetch runtime was adding
  // an extra request to every document despite the homepage not opting into
  // prefetched links; ClientRouter still works on routes that render it.
  prefetch: false,
  build: {
    // Keep the shared stylesheet cacheable instead of duplicating it inside
    // every rendered document. Only genuinely small styles stay inline.
    inlineStylesheets: "auto",
  },
  integrations: [
    preact(),
    sitemap({
      filter: page => {
        const pathname = new URL(page).pathname.replace(/\/+$/, "")
        return !SITEMAP_EXCLUDED_PATHS.has(pathname)
      },
      i18n: {
        defaultLocale: "en",
        locales: { en: "en", pl: "pl" },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Splitting stays on: with it off, the client and server Vite builds
      // each emit a ~130 KB stylesheet hash and every page links BOTH.
      // Known cosmetic waste either way (the server-side copy is never
      // fetched by browsers); revisit if Astro unifies the two builds.
      cssCodeSplit: true,
    },
  },
})
