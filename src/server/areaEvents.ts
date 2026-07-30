import { getStore } from "@netlify/blobs"

export type AreaEventName = "page_view" | "share"
export type AreaEventLang = "en" | "pl"

type AreaDailyEvents = {
  version: 1
  date: string
  totals: Record<AreaEventName, number>
  byLanguage: Record<AreaEventLang, Record<AreaEventName, number>>
  byDrop: Record<string, Partial<Record<AreaEventName, number>>>
  updatedAt: string
}

const STORE_NAME = "virya-area-events"
const MAX_CAS_ATTEMPTS = 6
const memoryEvents = new Map<string, AreaDailyEvents>()

const store = () => getStore({ name: STORE_NAME, consistency: "strong" })
const isDevelopment = () => Boolean(import.meta.env?.DEV)

const emptyRecord = (date: string): AreaDailyEvents => ({
  version: 1,
  date,
  totals: { page_view: 0, share: 0 },
  byLanguage: {
    en: { page_view: 0, share: 0 },
    pl: { page_view: 0, share: 0 },
  },
  byDrop: {},
  updatedAt: new Date().toISOString(),
})

const safeCount = (value: unknown) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0
    ? Math.min(parsed, 1_000_000_000)
    : 0
}

const normalize = (input: unknown, date: string): AreaDailyEvents => {
  if (!input || typeof input !== "object") return emptyRecord(date)
  const value = input as Partial<AreaDailyEvents>
  const byDrop: AreaDailyEvents["byDrop"] = {}
  if (value.byDrop && typeof value.byDrop === "object") {
    for (const [dropId, counts] of Object.entries(value.byDrop)) {
      if (!counts || typeof counts !== "object" || dropId.length > 64) continue
      const record = counts as Record<string, unknown>
      byDrop[dropId] = {
        page_view: safeCount(record.page_view),
        share: safeCount(record.share),
      }
    }
  }
  return {
    version: 1,
    date,
    totals: {
      page_view: safeCount(value.totals?.page_view),
      share: safeCount(value.totals?.share),
    },
    byLanguage: {
      en: {
        page_view: safeCount(value.byLanguage?.en?.page_view),
        share: safeCount(value.byLanguage?.en?.share),
      },
      pl: {
        page_view: safeCount(value.byLanguage?.pl?.page_view),
        share: safeCount(value.byLanguage?.pl?.share),
      },
    },
    byDrop,
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : new Date().toISOString(),
  }
}

export const recordAreaEvent = async ({
  event,
  lang,
  dropId,
}: {
  event: AreaEventName
  lang: AreaEventLang
  dropId?: string
}) => {
  const date = new Date().toISOString().slice(0, 10)
  const key = `daily/${date}`

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    try {
      const current = await store().getWithMetadata(key, {
        type: "json",
        consistency: "strong",
      })
      const record = normalize(current?.data, date)
      const next: AreaDailyEvents = {
        ...record,
        totals: { ...record.totals, [event]: record.totals[event] + 1 },
        byLanguage: {
          ...record.byLanguage,
          [lang]: {
            ...record.byLanguage[lang],
            [event]: record.byLanguage[lang][event] + 1,
          },
        },
        byDrop: dropId
          ? {
              ...record.byDrop,
              [dropId]: {
                ...record.byDrop[dropId],
                [event]: safeCount(record.byDrop[dropId]?.[event]) + 1,
              },
            }
          : record.byDrop,
        updatedAt: new Date().toISOString(),
      }
      const write = await store().setJSON(
        key,
        next,
        current ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
      )
      if (write.modified) return
    } catch (error) {
      if (!isDevelopment()) throw error
      const record = normalize(memoryEvents.get(key), date)
      const next: AreaDailyEvents = {
        ...record,
        totals: { ...record.totals, [event]: record.totals[event] + 1 },
        byLanguage: {
          ...record.byLanguage,
          [lang]: {
            ...record.byLanguage[lang],
            [event]: record.byLanguage[lang][event] + 1,
          },
        },
        byDrop: dropId
          ? {
              ...record.byDrop,
              [dropId]: {
                ...record.byDrop[dropId],
                [event]: safeCount(record.byDrop[dropId]?.[event]) + 1,
              },
            }
          : record.byDrop,
        updatedAt: new Date().toISOString(),
      }
      memoryEvents.set(key, next)
      return
    }
  }

  throw new Error("Area event counter is busy; retry")
}
