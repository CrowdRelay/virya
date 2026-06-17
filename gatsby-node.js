exports.onCreatePage = ({ page, actions }) => {
  const { createPage } = actions

  if (page.path === "/pl" || page.path.startsWith("/pl/")) return

  createPage({
    ...page,
    path: `/pl${page.path}`,
    context: { ...page.context, lang: "pl" },
  })
}
