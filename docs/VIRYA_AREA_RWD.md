# VIRYA Area — mobile RWD pass

This pass targets 320–430 px mobile viewports without changing the desktop layout or Area game logic.

## Changes

- Uses `viewport-fit=cover` and safe-area insets for notched iPhones.
- Prevents horizontal overflow at the document and Area component levels.
- Scales hero and section headings with `clamp()` and allows emergency wrapping.
- Stacks hero CTAs on mobile and keeps touch targets at least 48 px high.
- Reduces mobile section/card padding while preserving desktop spacing.
- Makes the map, city selector, profile panel, wallet, reward codes and collection cards shrink safely.
- Uses one city column below 360 px and two columns from 360 px upward.
- Makes generated reward-code rows and action buttons fit narrow screens.
- Adds mobile-safe wrapping for coordinates, collectible states and long Polish copy.

## Verification performed

- `git diff --check`
- TypeScript validation of the client script extracted from `AreaExperience.astro`
- CSS parsing with `tinycss2` (no parse errors)

A full Astro build still requires project dependencies:

```bash
npm ci
npm run build
```

Recommended manual viewport checks: 320×568, 360×800, 375×812, 390×844, 430×932, plus landscape 844×390.
