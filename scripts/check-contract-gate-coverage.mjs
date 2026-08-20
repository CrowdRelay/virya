// A contract file that no gate runs is not a contract. Both the merch
// event-pickup guard and the Synesthesia handoff-recovery guard were written
// alongside the fixes they protect, then sat unreferenced for months: the code
// they cover could drift with every audit still green.
import fs from 'node:fs'

const url = (path) => new URL(`../${path}`, import.meta.url)
const pkg = JSON.parse(fs.readFileSync(url('package.json'), 'utf8'))
const scripts = pkg.scripts ?? {}
if (!scripts.test) throw new Error('package.json must define a "test" gate')

const declared = Object.values(scripts).join(' ')
const workflows = fs
  .readdirSync(url('.github/workflows'))
  .map((name) => fs.readFileSync(url(`.github/workflows/${name}`), 'utf8'))
  .join('\n')

const reachable = new Set()
const walk = (name, seen = new Set()) => {
  if (seen.has(name)) return
  seen.add(name)
  const body = scripts[name]
  if (!body) return
  reachable.add(body)
  for (const [, called] of body.matchAll(/npm run ([\w:-]+)/g)) walk(called, seen)
}
walk('test')
const reachableText = [...reachable].join(' ')

const files = fs.readdirSync(url('scripts')).filter((name) => /\.(mjs|py|ts|js)$/.test(name))
// `test*` names a contract: it asserts an invariant and takes no arguments, so
// it belongs in the always-on gate. `audit-*`/`check-*` may be parameterised
// build steps, so they only have to be wired somewhere.
const contracts = files.filter((name) => /^test[-_]/.test(name))
const auditors = files.filter((name) => /^(audit|check)[-_]/.test(name))

const unreachable = contracts.filter((name) => !reachableText.includes(name))
if (unreachable.length > 0) {
  throw new Error(`contract scripts unreachable from "npm test": ${unreachable.join(', ')}`)
}
const unwired = auditors.filter((name) => !declared.includes(name) && !workflows.includes(name))
if (unwired.length > 0) {
  throw new Error(`audit scripts wired to nothing: ${unwired.join(', ')}`)
}

console.log(
  `VIRYA_GATE_COVERAGE=PASS contracts=${contracts.length} auditors=${auditors.length} reachable-from=npm-test`,
)
