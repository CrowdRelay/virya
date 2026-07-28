import { t, type Lang } from "./t"

const KEYS = {
  shows: [
    "shows.date", "shows.event", "shows.heading", "shows.joinCta",
    "shows.none", "shows.sub", "shows.tickets", "shows.today",
  ],
  newsletter: [
    "contact.email", "newsletter.heading", "newsletter.join",
    "newsletter.joining", "newsletter.noSpam", "newsletter.placeholder",
    "newsletter.sub", "newsletter.success",
  ],
  contact: [
    "contact.booking", "contact.email", "contact.epk", "contact.error",
    "contact.heading", "contact.message", "contact.name", "contact.send",
    "contact.sub", "contact.thankBody",
  ],
} as const

export const getHomepageMessages = (lang: Lang) =>
  Object.fromEntries(
    Object.entries(KEYS).map(([section, keys]) => [
      section,
      Object.fromEntries(keys.map((key) => [key, t(lang, key)])),
    ])
  ) as Record<keyof typeof KEYS, Record<string, string>>
