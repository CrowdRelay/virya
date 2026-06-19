const path = require("path")
const releases = require("./src/components/portfolio/items.json")

const slugify = s =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

// A dedicated, indexable page per release. onCreatePage (below) mirrors each
// one to /pl/music/<slug> with lang context, same as the static pages.
exports.createPages = ({ actions }) => {
  const { createPage } = actions
  const component = path.resolve("src/templates/release.js")
  releases.forEach(release => {
    const slug = slugify(release.title)
    createPage({
      path: `/music/${slug}`,
      component,
      context: { release, slug },
    })
    createPage({
      path: `/pl/music/${slug}`,
      component,
      context: { release, slug, lang: "pl" },
    })
  })
}

exports.onCreatePage = ({ page, actions }) => {
  const { createPage } = actions

  if (page.path === "/pl" || page.path.startsWith("/pl/")) return

  createPage({
    ...page,
    path: `/pl${page.path}`,
    context: { ...page.context, lang: "pl" },
  })
}
