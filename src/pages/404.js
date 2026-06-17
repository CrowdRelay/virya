import React from "react"
import { Link } from "gatsby"
import Layout from "../components/layout"
import { useI18n } from "../i18n/I18nContext"

const NotFoundPage = () => {
  const { t } = useI18n()
  return (
    <Layout title="404: Not found | Virya">
      <p className="p-4 text-2xl text-white">{t("notFound.title")}</p>
      <p>
        <Link title={t("nav.home")} className="p-4 text-amber-300 cursor-pointer" to="/">{t("notFound.back")}</Link>
      </p>
    </Layout>
  )
}

export const Head = () => (
  <>
    <title>404: Not found | Virya</title>
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#09090b" />
    <meta name="description" content="Page not found." />
  </>
)

export default NotFoundPage
