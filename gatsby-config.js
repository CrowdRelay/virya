module.exports = {
  siteMetadata: {
    title: `Virya | Modern metalcore from Poland`,
    author: {
      name: `Virya`,
      summary: `Artist, musician, composer, guitarist, multiinstrumentalist`,
    },
    description: `A website of Virya, a new modern metalcore powerhorse from Poland. Check out the latest releases and news.`,
    siteUrl: `https://www.virya.music`,
    social: {
      facebook: `ViryaBand`,
      twitter: `https://x.com/viryaofficial`,
    },
  },
  flags: {
    PARALLEL_SOURCING: true,
    PRESERVE_FILE_DOWNLOAD_CACHE: true,
  },
  plugins: [
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `pages`,
        path: `${__dirname}/src/pages/`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        path: `${__dirname}/src/images`,
        name: "img",
      },
    },
    `gatsby-plugin-image`,
    `gatsby-plugin-sharp`,
    `gatsby-transformer-sharp`,
    `gatsby-plugin-postcss`,
    `gatsby-plugin-sitemap`,
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `Virya`,
        short_name: `Virya`,
        start_url: `/`,
        background_color: `#09090b`,
        theme_color: `#09090b`,
        display: `minimal-ui`,
        icon: `src/images/virya.webp`,
        cache_busting_mode: 'none',
        prefer_related_applications: true,
        icons: [
          {
            src: "src/images/virya72.png",
            sizes: "72x72",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "src/images/virya96.png",
            sizes: "96x96",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "src/images/virya128.png",
            sizes: "128x128",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "src/images/virya144.png",
            sizes: "144x144",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "src/images/virya152.png",
            sizes: "152x152",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "src/images/virya192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "src/images/virya384.png",
            sizes: "384x384",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "src/images/virya512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ],
      },
    },
  ],
}
