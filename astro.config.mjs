import { defineConfig } from "astro/config"
import preact from "@astrojs/preact"
import netlify from "@astrojs/netlify"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  site: "https://www.virya.music",
  output: "server",
  adapter: netlify(),
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },
  integrations: [
    preact(),
    sitemap({
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
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules/preact')) return 'preact'
            if (id.includes('/i18n/translations') || id.includes('/i18n/I18nContext')) return 'i18n'
            if (id.includes('/data/products')) return 'products'
          },
        },
      },
    },
  },
})
