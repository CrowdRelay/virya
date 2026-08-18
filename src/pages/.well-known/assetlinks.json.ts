import type { APIRoute } from "astro"
import { readServerEnv } from "../../server/runtimeEnv"

export const prerender = false

const PACKAGE_NAME = "music.virya.signal"
const FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/

const fingerprints = () => (readServerEnv(
  "VIRYA_SIGNAL_ANDROID_APP_LINK_SHA256",
  import.meta.env.VIRYA_SIGNAL_ANDROID_APP_LINK_SHA256,
) ?? "")
  .split(",")
  .map(value => value.trim().toUpperCase())
  .filter((value, index, values) => FINGERPRINT.test(value) && values.indexOf(value) === index)

export const GET: APIRoute = async () => {
  const sha256CertFingerprints = fingerprints()
  const body = sha256CertFingerprints.length === 0 ? [] : [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: PACKAGE_NAME,
      sha256_cert_fingerprints: sha256CertFingerprints,
    },
  }]
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
