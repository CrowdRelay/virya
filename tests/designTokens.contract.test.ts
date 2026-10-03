import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { extname, join } from "node:path"
import test from "node:test"

// Design-token ratchet — today's numbers are the ceiling.
//
// Ported from the control-plane shadCN migration (scripts/test_design_tokens.py):
// every one of these counts was paid for by drift. A rule that lives only in a
// plan gets broken by the next session; this ratchet is the rule. It turns one
// way — a lower count is a win and the baseline must be lowered in the same
// commit. A higher count fails.
//
// Counts and what stays out of them:
//
// - `radiusVariants` — distinct `rounded*` utilities in markup. Each variant is
//   a scale someone chose; five are in use today.
// - `textPxArbitrary` — `text-[Npx]` utilities. The micro-label scale
//   (9/10/11px) predates a named scale; new work uses the named sizes.
// - `arbitraryPxTotal` — every `utility-[Npx]` arbitrary value in markup.
//   Includes touch-target sizes like min-h-[44px], which are intentional —
//   the ratchet freezes the count rather than outlawing the mechanism.
// - `hexOutsideExempt` — hex literals in markup outside the exempt list.
//   Remaining hits are art/data colors (SVG gradient stops, print sheets,
//   brand palettes), not theme colors — theme colors live in --virya-* tokens.
// - `buttonsMissingType` — <button> without an explicit type attribute.
//   Inside a <form> a typeless button is an implicit submit; the 2026-09 sweep
//   fixed all 56 and this keeps it at zero.
// - `shadowUtilities` — `shadow-*` classes in markup. Elevation is a decision;
//   new shadows need a baseline bump with an argument, not a reflex.
//
// Exempt from the hex count: src/pages/api/** (mail/OG render colors are data),
// PlayStoreBadge.astro (Google brand palette), and everything outside
// src/{pages,components,client}. The regex also skips &#NNNN; HTML entities,
// which are not colors.

const SRC = new URL("../src/", import.meta.url)
const SCOPES = ["pages", "components", "client"]
const MARKUP = new Set([".astro", ".jsx", ".tsx", ".ts"])
const HEX_EXEMPT = [/src\/pages\/api\//, /PlayStoreBadge\.astro$/]

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const child = join(dir, entry)
    if (statSync(child).isDirectory()) yield* walk(child)
    else if (MARKUP.has(extname(child))) yield child
  }
}

function sources(): [string, string][] {
  const root = SRC.pathname
  const out: [string, string][] = []
  for (const scope of SCOPES) {
    for (const path of walk(join(root, scope))) {
      out.push([path, readFileSync(path, "utf8")])
    }
  }
  return out
}

const ALL = sources()

function ratchet(name: string, actual: number, baseline: number) {
  assert.equal(
    actual,
    baseline,
    `${name}: counted ${actual}, baseline is ${baseline}. ` +
      (actual > baseline
        ? "New drift — route it through tokens, or raise the baseline with an argument in this test."
        : "Count improved — lower the baseline in this commit so the win is permanent."),
  )
}

test("design-token ratchet — markup stays inside the counted scales", () => {
  const radii = new Set<string>()
  let textPx = 0
  let arbitraryPx = 0
  let hex = 0
  let buttonsMissingType = 0
  let shadows = 0

  for (const [path, source] of ALL) {
    for (const match of source.matchAll(
      /\brounded(?:-[a-z0-9]+(?:\/\d+)?|-\[[^\]]+\])?/g,
    )) {
      radii.add(match[0])
    }
    textPx += source.match(/\btext-\[\d+px\]/g)?.length ?? 0
    arbitraryPx += source.match(/\b[a-zA-Z-]+-\[\d+px\]/g)?.length ?? 0
    shadows +=
      source.match(/\bshadow-(?:sm|md|lg|xl|2xl|inner|none)\b|\bshadow-\[/g)
        ?.length ?? 0

    if (!HEX_EXEMPT.some(pattern => pattern.test(path))) {
      hex += source.match(/(?<!&)#[0-9a-fA-F]{3,8}\b/g)?.length ?? 0
    }

    // `=>` must be consumed as a unit — a bare `>` inside an arrow-function
    // attribute would truncate the tag and hide a trailing `type=`.
    for (const match of source.matchAll(/<button\b(?:=>|[^>])*>/gs)) {
      // (?<![\w-]) — `data-type=` must not satisfy the check.
      if (!/(?<![\w-])type\s*=/.test(match[0])) buttonsMissingType += 1
    }
  }

  ratchet("radiusVariants", radii.size, 5)
  // The consented single-step Signal form removes three micro-labels and
  // four arbitrary utilities from the obsolete preregistration stage.
  ratchet("textPxArbitrary", textPx, 340)
  // MySignal's mission buttons drop their min-h-[46px] overrides —
  // .virya-button already enforces a taller 3rem floor, so the
  // utilities were both drift and a regression of the component min.
  ratchet("arbitraryPxTotal", arbitraryPx, 499)
  ratchet("hexOutsideExempt", hex, 12)
  ratchet("buttonsMissingType", buttonsMissingType, 0)
  ratchet("shadowUtilities", shadows, 17)
})
