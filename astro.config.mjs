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
  // Remove these two entries when the first real news post is published.
  "/news",
  "/pl/news",
])

export default defineConfig({
  site: "https://www.virya.music",
  output: "server",
  adapter: netlify(),
  prefetch: {
    defaultStrategy: "hover",
  },
  build: {
    inlineStylesheets: 'always',
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
      cssCodeSplit: true,
    },
  },
})
