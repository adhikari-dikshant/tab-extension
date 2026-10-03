import {
    BENTO_WIDGET_IDS, DATA_SCHEMA_VERSION, DEFAULT_SETTINGS, SETTINGS_VERSION,
    ensureInstallId, type Note, type RecordMeta, type Settings, type Shortcut, type Todo, type WidgetId, type Workspace,
} from './storage'
import { changeStored } from './productivity'

/**
 * Widget ids introduced in each version bump. A stored `widgetsEnabled` array was written before
 * these ids existed, so without this they would read as "switched off" for everyone upgrading
 * while a fresh install got them on — the asymmetry that previously needed a hand-written
 * special case per widget. Record the ids here instead and the migration handles the rest.
 */
const WIDGETS_ADDED_IN: Record<number, WidgetId[]> = {
    1: ['notes', 'workspaces'],
}

/** Where a newly-introduced bento card should land in an existing `cardOrder`, so upgrading
 * users get the same layout as a fresh install rather than the new card tacked on at the end. */
const CARDS_ADDED_IN: Record<number, { id: (typeof BENTO_WIDGET_IDS)[number]; after: (typeof BENTO_WIDGET_IDS)[number] }[]> = {
    1: [{ id: 'notes', after: 'mostVisited' }],
}

/** Cards that stopped being cards. Their widget toggle is kept — the feature still exists, it just
 * renders somewhere other than the grid — but they must leave `cardOrder` and `featuredCards` or
 * the layout would reserve a cell for something that no longer draws one. */
const CARDS_REMOVED_IN: Record<number, string[]> = {
    3: ['weather'],
}

/** Settings fields dropped in a version bump, so they stop riding along in exports forever. */
const FIELDS_REMOVED_IN: Record<number, string[]> = {
    1: ['notesEnabled'],
    2: ['featuredCard'],
}

/** Fields dropped in an earlier version that an object on disk may still carry. */
interface LegacySettings {
    notesEnabled?: boolean
    /** v1 emphasised exactly one card; v2 emphasises a pair. */
    featuredCard?: string
}

/** Settings as they may exist on disk: any current field can be absent, and dropped fields can
 * still be present. */
export type StoredSettings = Partial<Settings> & LegacySettings

/**
 * Brings a stored settings object up to SETTINGS_VERSION. Pure and idempotent — re-running it on
 * already-current settings returns an equivalent object, so it is safe to call on every load.
 */
export function migrateSettings(stored: StoredSettings): Settings {
    const from = typeof stored.settingsVersion === 'number' ? stored.settingsVersion : 0
    const next: Record<string, unknown> = { ...stored }

    let enabled = Array.isArray(stored.widgetsEnabled)
        ? [...stored.widgetsEnabled]
        : [...DEFAULT_SETTINGS.widgetsEnabled]
    const order = Array.isArray(stored.cardOrder) ? [...stored.cardOrder] : [...DEFAULT_SETTINGS.cardOrder]

    for (let version = from + 1; version <= SETTINGS_VERSION; version++) {
        for (const id of WIDGETS_ADDED_IN[version] ?? []) {
            if (!enabled.includes(id)) enabled.push(id)
        }
        for (const { id, after } of CARDS_ADDED_IN[version] ?? []) {
            if (order.includes(id)) continue
            const at = order.indexOf(after)
            order.splice(at < 0 ? order.length : at + 1, 0, id)
        }
        for (const retired of CARDS_REMOVED_IN[version] ?? []) {
            const at = order.indexOf(retired as (typeof BENTO_WIDGET_IDS)[number])
            if (at >= 0) order.splice(at, 1)
        }
        for (const field of FIELDS_REMOVED_IN[version] ?? []) delete next[field]
    }

    // `notesEnabled` was the standalone switch for the Notes card and rail entry before `notes`
    // joined widgetsEnabled. Someone who had deliberately turned it off keeps it off.
    if (from < 1 && stored.notesEnabled === false) enabled = enabled.filter((id) => id !== 'notes')

    // v1 chose one card to enlarge. Keep that choice as the first of the pair and fill the second
    // from the defaults, so an upgrade neither loses the preference nor leaves a half-set layout.
    let featured = Array.isArray(stored.featuredCards) ? [...stored.featuredCards] : []
    if (from < 2 && !featured.length) {
        const previous = stored.featuredCard
        const kept = BENTO_WIDGET_IDS.find((id) => id === previous)
        featured = kept
            ? [kept, ...DEFAULT_SETTINGS.featuredCards.filter((id) => id !== kept)].slice(0, 2)
            : [...DEFAULT_SETTINGS.featuredCards]
    }
    // Anything retired above, or never a card, cannot hold a featured slot.
    featured = featured.filter((id) => BENTO_WIDGET_IDS.includes(id))
    if (!featured.length) featured = [...DEFAULT_SETTINGS.featuredCards]

    return {
        ...DEFAULT_SETTINGS, ...next,
        widgetsEnabled: enabled, cardOrder: order, featuredCards: featured.slice(0, 2),
        settingsVersion: SETTINGS_VERSION,
    }
}

/** Runs the migration against stored settings exactly once per load; writes only if something
 * actually changed (changeStored compares before persisting). */
export function runSettingsMigration() {
    return changeStored('settings', DEFAULT_SETTINGS, (settings) => migrateSettings(settings))
}


// ---------- Data (records) ----------

/** A record as it may exist on disk: before DATA_SCHEMA_VERSION 1, timestamps were inconsistent —
 * `Todo` had only `createdAt`, `Note` only `updatedAt`, `Shortcut` neither. */
interface LegacyRecord {
    id?: unknown
    createdAt?: unknown
    updatedAt?: unknown
    /** Todo's only other time signal, used as an `updatedAt` estimate when nothing better exists. */
    lastCompletedAt?: unknown
}

/**
 * Backfills the metadata every record now carries. Timestamps are guessed from whatever the record
 * already had rather than stamped with "now", so ordering and recency survive the upgrade — a note
 * edited last year must not suddenly look newer than one edited today, or the first merge-import
 * would resolve every conflict the wrong way.
 */
export function migrateRecord<T extends LegacyRecord>(record: T, fallback: number): T & RecordMeta {
    const createdAt = typeof record.createdAt === 'number' ? record.createdAt
        : typeof record.updatedAt === 'number' ? record.updatedAt
            : fallback
    const updatedAt = typeof record.updatedAt === 'number' ? record.updatedAt
        : typeof record.lastCompletedAt === 'number' ? record.lastCompletedAt
            : createdAt
    return { ...record, id: typeof record.id === 'string' && record.id ? record.id : crypto.randomUUID(), createdAt, updatedAt }
}

function migrateList<T extends LegacyRecord>(list: unknown, fallback: number): (T & RecordMeta)[] | null {
    if (!Array.isArray(list)) return null
    return list.filter((entry): entry is T => typeof entry === 'object' && entry !== null)
        .map((entry) => migrateRecord(entry, fallback))
}

/**
 * Brings stored records up to DATA_SCHEMA_VERSION and stamps the version so this only does work
 * once. Separate from `migrateSettings` because records and preferences version independently —
 * adding a field to Settings should not force a rewrite of every note.
 */
export async function runDataMigration(): Promise<void> {
    const { schemaVersion } = await chrome.storage.local.get('schemaVersion')
    if (typeof schemaVersion === 'number' && schemaVersion >= DATA_SCHEMA_VERSION) return

    // Records with no timestamp at all are ordered behind everything that has one.
    const fallback = 0

    await changeStored('todos', [], (items) => migrateList<Todo>(items, fallback) ?? items)
    await changeStored('notes', [], (items) => migrateList<Note>(items, fallback) ?? items)
    await changeStored('shortcuts', [], (items) => migrateList<Shortcut>(items, fallback) ?? items)
    await changeStored('aiTools', [], (items) => migrateList<Shortcut>(items, fallback) ?? items)
    await changeStored('workspaces', [], (items) => migrateList<Workspace>(items, fallback) ?? items)

    await chrome.storage.local.set({ schemaVersion: DATA_SCHEMA_VERSION })
}

/** Everything that must happen before the dashboard trusts what it reads. Safe to call on every
 * load: each step checks its own version marker and writes only when something changed. */
export async function runMigrations(): Promise<void> {
    await ensureInstallId()
    await runSettingsMigration()
    await runDataMigration()
}
