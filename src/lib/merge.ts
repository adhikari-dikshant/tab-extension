import { SCREENTIME_KEY_PATTERN, tierFor, type RecordMeta, type ScreenTimeDayLike } from './storage'

/**
 * Collapses a record down to the content that makes it "the same thing" as another record, so a
 * backup carried to a second browser profile merges instead of duplicating. Ids can't do this job
 * alone: they're minted per device with `crypto.randomUUID()`, so the same task added by hand on
 * two machines has two ids and would import twice.
 *
 * Returning null means "no content key" — such a record is matched by id only.
 */
export type DedupeKey = (record: Record<string, unknown>) => string | null

function text(value: unknown): string {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : ''
}

/** Treats the same destination written different ways as one link: scheme, `www.`, a trailing
 * slash and case in the host are all cosmetic. The path's case is not, so it is left alone. */
export function normalizeUrl(raw: unknown): string {
    const value = typeof raw === 'string' ? raw.trim() : ''
    if (!value) return ''
    try {
        const url = new URL(value)
        const host = url.hostname.replace(/^www\./i, '').toLowerCase()
        const path = url.pathname.replace(/\/+$/, '')
        return `${host}${path}${url.search}`
    } catch {
        return value.toLowerCase()
    }
}

export const DEDUPE_KEYS: Record<string, DedupeKey> = {
    // One link per destination. Labels differ between profiles; the URL is the identity.
    shortcuts: (record) => normalizeUrl(record.url) || null,
    aiTools: (record) => normalizeUrl(record.url) || null,
    // Same wording on the same day is the same task. Wording alone would wrongly merge a daily
    // habit's separate instances, so the due date is part of the key.
    todos: (record) => text(record.text) ? `${text(record.text)}|${text(record.dueDate)}` : null,
    // A note is identified by its title plus the opening of its body — enough to catch a
    // re-imported copy without merging two genuinely different notes that share a title.
    notes: (record) => {
        const key = `${text(record.title)}|${text(record.body).slice(0, 200)}`
        return key === '|' ? null : key
    },
    // A workspace is its name plus the set of tabs it restores.
    workspaces: (record) => {
        const name = text(record.name)
        const tabs = Array.isArray(record.tabs)
            ? record.tabs.map((tab) => normalizeUrl((tab as { url?: unknown })?.url)).filter(Boolean).sort().join(',')
            : ''
        return name || tabs ? `${name}|${tabs}` : null
    },
}

function isNewer(candidate: RecordMeta, existing: RecordMeta): boolean {
    if (candidate.updatedAt !== existing.updatedAt) return candidate.updatedAt > existing.updatedAt
    // Equal timestamps: prefer whichever was created first, so the result doesn't depend on which
    // side of the merge a record happened to be on.
    return candidate.createdAt < existing.createdAt
}

export interface ListMergeResult<T> {
    merged: T[]
    added: number
    updated: number
    unchanged: number
}

/**
 * Merges an incoming list into the existing one. Existing order is preserved and new records are
 * appended, so importing never reshuffles a list the user has arranged. A record that matches by id
 * or by content key updates the existing one only when it is genuinely newer.
 */
export function mergeList<T extends RecordMeta>(existing: T[], incoming: T[], dedupeKey?: DedupeKey): ListMergeResult<T> {
    const merged = [...existing]
    const byId = new Map<string, number>()
    const byKey = new Map<string, number>()
    merged.forEach((record, index) => {
        byId.set(record.id, index)
        const key = dedupeKey?.(record as unknown as Record<string, unknown>)
        if (key && !byKey.has(key)) byKey.set(key, index)
    })

    let added = 0
    let updated = 0
    let unchanged = 0

    for (const record of incoming) {
        const key = dedupeKey?.(record as unknown as Record<string, unknown>)
        const at = byId.get(record.id) ?? (key ? byKey.get(key) : undefined)
        if (at === undefined) {
            byId.set(record.id, merged.length)
            if (key && !byKey.has(key)) byKey.set(key, merged.length)
            merged.push(record)
            added++
            continue
        }
        if (isNewer(record, merged[at])) {
            // Keep the id already on this device so anything referencing it (a focus session's
            // taskId, for instance) stays valid after the merge.
            merged[at] = { ...record, id: merged[at].id }
            updated++
        } else {
            unchanged++
        }
    }

    return { merged, added, updated, unchanged }
}

/** Screen time is additive per domain, not a record list: two devices' histories for the same day
 * are each real. The higher total is kept rather than summed, since the same day on the same device
 * exported twice would otherwise double. */
export function mergeScreenTimeDay(existing: ScreenTimeDayLike, incoming: ScreenTimeDayLike): ScreenTimeDayLike {
    const domains: Record<string, number> = { ...existing.domains }
    for (const [domain, seconds] of Object.entries(incoming.domains)) {
        domains[domain] = Math.max(domains[domain] ?? 0, seconds)
    }
    return {
        totalSeconds: Math.max(existing.totalSeconds, incoming.totalSeconds),
        domains,
        lastUpdated: Math.max(existing.lastUpdated, incoming.lastUpdated),
    }
}

/** Keys a merge is allowed to touch. The `device` tier is excluded: screen time from another
 * machine is not this machine's history, and `installId` must stay this install's own. */
export function isMergeable(key: string): boolean {
    if (SCREENTIME_KEY_PATTERN.test(key)) return false
    return tierFor(key) === 'portable'
}
