// Mirror every page under /pl/* with a Polish language context, so each page is
// statically server-rendered in its own language. English stays at the root
// (no lang context → defaults to English in the provider).
exports.onCreatePage = ({ page, actions }) => {
  const { createPage } = actions

  // Don't re-mirror the Polish pages we create (prevents an infinite loop).
  if (page.path === "/pl" || page.path.startsWith("/pl/")) return

  createPage({
    ...page,
    path: `/pl${page.path}`,
    context: { ...page.context, lang: "pl" },
  })
}
