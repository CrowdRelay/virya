import { readFileSync } from "node:fs";

const rum = readFileSync(new URL("../public/rum.js", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/components/Layout.astro", import.meta.url), "utf8");
const required = [
  "const SAMPLE_RATE = 0.05",
  "Math.random() >= SAMPLE_RATE",
  "https://signal-api.virya.music/v1/public/telemetry/rum",
  'surface: "virya_www"',
  '"lcp_ms"',
  '"inp_ms"',
  '"cls_milli"',
  '"ttfb_ms"',
  'credentials: "omit"',
  'keepalive: true',
];
for (const token of required) {
  if (!rum.includes(token)) throw new Error(`Virya RUM missing contract token: ${token}`);
}
for (const forbidden of ["localStorage", "sessionStorage", "user_id", "email", "fingerprint", "document.cookie"]) {
  if (rum.includes(forbidden)) throw new Error(`Virya RUM must remain identity-free: ${forbidden}`);
}
if (!layout.includes('<script src="/rum.js" defer></script>')) {
  throw new Error("Virya layout must load the bounded first-party RUM collector");
}
console.log("VIRYA_RUM=PASS sample=5% identity=none metrics=web-vitals-subset");
