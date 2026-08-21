import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../src/pages/api/", import.meta.url));
const baseline = 80;
let count = 0;
function walk(dir) { for (const name of readdirSync(dir)) { const path = join(dir, name); const st = statSync(path); if (st.isDirectory()) walk(path); else if (/\.(ts|js)$/.test(name)) count++; } }
walk(root);
if (count > baseline) { console.error(`API_ROUTE_BUDGET=FAIL routes=${count} baseline=${baseline}; prefer direct public CrowdRelay reads or retire an existing BFF route before adding one`); process.exit(1); }
console.log(`API_ROUTE_BUDGET=PASS routes=${count} baseline=${baseline}`);
