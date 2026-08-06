/**
 * Read server-only configuration at request time when deployed on Netlify.
 *
 * Astro/Vite may inline `import.meta.env` while building the server bundle.
 * Netlify production variables can be injected only when the function runs,
 * so server modules must prefer `process.env` and keep the build-time value as
 * a local-development fallback.
 */
export const readServerEnv = (
  name: string,
  buildTimeValue?: string,
): string | undefined => {
  const runtimeValue =
    typeof process !== "undefined" ? process.env?.[name] : undefined
  const value =
    typeof runtimeValue === "string" && runtimeValue.trim()
      ? runtimeValue
      : buildTimeValue
  return typeof value === "string" ? value.trim() || undefined : undefined
}
