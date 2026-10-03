import {
    ACCENT_PRESETS, BENTO_WIDGET_IDS, DATA_SCHEMA_VERSION, DEFAULT_SETTINGS, EXPORT_APP_ID,
    SCREENTIME_KEY_PATTERN, WIDGET_IDS, tierFor,
    type Note, type RecordMeta, type ScreenTimeDayLike, type Settings, type Shortcut, type Source, type Todo, type Workspace,
} from './storage'
import { migrateSettings } from './migrations'
import { safeWebUrl } from './productivity'
import { DEDUPE_KEYS, isMergeable, mergeList, mergeScreenTimeDay } from './merge'

/** Every key a backup may legitimately contain, besides the dated `screentime:` entries.
 * `schemaVersion` and `installId` are recognised so they aren't reported as unknown, but neither is
 * imported: the validator already repairs records to the current shape, and identity stays local. */
const KNOWN_KEYS = [
    'settings', 'shortcuts', 'aiTools', 'todos', 'notes', 'workspaces', 'focus',
    'weather:cache', 'quotes:cache', 'backup:lastExport', 'schemaVersion', 'installId',
] as const

const SCREENTIME_KEY = SCREENTIME_KEY_PATTERN

/**
 * Envelope written by `buildExport`. The payload sits under `data` so the file can describe itself:
 * `schemaVersion` tells a future importer how to read the records, and `exportedBy.installId`
 * identifies the profile it came from so a merge can tell another device's file from this one's own
 * backup.
 *
 * Files written before this envelope existed are a bare `chrome.storage.local` dump with no
 * wrapper. `readEnvelope` accepts both, so every backup anyone already has still imports.
 */
export interface BackupEnvelope {
    app: typeof EXPORT_APP_ID
    schemaVersion: number
    exportedAt: number
    exportedBy: { extensionVersion: string; installId: string }
    /** Which storage tiers the file includes, so an importer can say what is actually in it. */
    includes: string[]
    data: Record<string, unknown>
}

export interface BackupReport {
    /** Storage payload to write — only keys that passed validation. */
    data: Record<string, unknown>
    /** Schema version the file declared; 0 for a pre-envelope flat dump. */
    schemaVersion: number
    /** Absent for a legacy flat dump, which carries no provenance. */
    exportedBy?: BackupEnvelope['exportedBy']
    exportedAt?: number
    /** True when the file came from this very installation, which makes "replace" the sensible
     * default rather than a merge against itself. */
    sameInstall?: boolean
    /** Human-readable summary per accepted key, e.g. "12 to-dos". */
    accepted: string[]
    /** Keys that were present but unusable, or entries dropped from an otherwise valid list. */
    skipped: string[]
    /** Set when the file cannot be used at all; `data` is empty in that case. */
    error?: string
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Rebuilds the metadata every record carries, keeping a file's own timestamps when it has them so
 * a merge can still resolve by recency. A record with none sorts behind anything that does. */
function meta(entry: Record<string, unknown>): RecordMeta {
    const createdAt = num(entry.createdAt, num(entry.updatedAt, 0))
    return {
        id: id(entry.id),
        createdAt,
        updatedAt: num(entry.updatedAt, createdAt),
        ...(source(entry.source) ? { source: source(entry.source)! } : {}),
    }
}

function source(value: unknown): Source | null {
    if (!isObject(value)) return null
    const url = str(value.url, 2048)
    if (!safeWebUrl(url)) return null
    return { url, capturedAt: num(value.capturedAt, 0), ...(value.title ? { title: str(value.title, 300) } : {}) }
}

function str(value: unknown, max: number, fallback = ''): string {
    return typeof value === 'string' ? value.slice(0, max) : fallback
}

function bool(value: unknown, fallback = false): boolean {
    return typeof value === 'boolean' ? value : fallback
}

function num(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function id(value: unknown): string {
    const found = str(value, 64)
    return found || crypto.randomUUID()
}

/** Keeps only entries a validator could make sense of, reporting how many it dropped. */
function validList<T>(value: unknown, label: string, map: (entry: Record<string, unknown>) => T | null, skipped: string[]): T[] | null {
    if (!Array.isArray(value)) return null
    const kept: T[] = []
    for (const entry of value) {
        if (!isObject(entry)) continue
        const mapped = map(entry)
        if (mapped !== null) kept.push(mapped)
    }
    const dropped = value.length - kept.length
    if (dropped > 0) skipped.push(`${dropped} unreadable ${label}`)
    return kept
}

/**
 * Rebuilds Settings field by field from DEFAULT_SETTINGS. `useStorageValue`'s shallow merge only
 * fills in *absent* fields — a present-but-wrong value (`cardOrder: null`) still reaches the UI and
 * crashes it, so every field is checked here rather than trusted.
 */
export function sanitizeSettings(value: unknown): Settings {
    if (!isObject(value)) return { ...DEFAULT_SETTINGS }
    const d = DEFAULT_SETTINGS
    const oneOf = <T extends string>(raw: unknown, options: readonly T[], fallback: T): T =>
        typeof raw === 'string' && (options as readonly string[]).includes(raw) ? (raw as T) : fallback

    const location = value.location
    const wallpaper = value.wallpaper

    const settings: Settings = {
        settingsVersion: num(value.settingsVersion, 0),
        theme: oneOf(value.theme, ['system', 'light', 'dark'], d.theme),
        accentColor: /^#[0-9a-f]{6}$/i.test(str(value.accentColor, 7)) ? str(value.accentColor, 7) : ACCENT_PRESETS[4],
        opacity: Math.min(100, Math.max(0, Math.round(num(value.opacity, d.opacity)))),
        searchEngine: oneOf(value.searchEngine, ['google', 'duckduckgo', 'bing', 'brave', 'youtube', 'wikipedia'], d.searchEngine),
        hideSearchEngines: bool(value.hideSearchEngines, d.hideSearchEngines),
        greetingName: str(value.greetingName, 80),
        customText: str(value.customText, 500),
        clockFormat: oneOf(value.clockFormat, ['12h', '24h'], d.clockFormat),
        clockStyle: oneOf(value.clockStyle, ['digital', 'analog'], d.clockStyle),
        tempUnit: oneOf(value.tempUnit, ['celsius', 'fahrenheit'], d.tempUnit),
        location: isObject(location) && typeof location.lat === 'number' && typeof location.lon === 'number'
            ? { lat: location.lat, lon: location.lon, label: str(location.label, 120) }
            : 'auto',
        wallpaper: isObject(wallpaper) && (wallpaper.type === 'upload' || wallpaper.type === 'daily-random')
            ? { type: wallpaper.type, value: typeof wallpaper.value === 'string' ? wallpaper.value : null }
            : { type: 'none', value: null },
        adaptiveIcons: bool(value.adaptiveIcons, d.adaptiveIcons),
        widgetsEnabled: Array.isArray(value.widgetsEnabled)
            ? WIDGET_IDS.filter((widget) => (value.widgetsEnabled as unknown[]).includes(widget))
            : [...d.widgetsEnabled],
        language: str(value.language, 16) || d.language,
        screenTimeEnabled: bool(value.screenTimeEnabled, d.screenTimeEnabled),
        searchSuggestionsEnabled: bool(value.searchSuggestionsEnabled, d.searchSuggestionsEnabled),
        hideMicrophone: bool(value.hideMicrophone, d.hideMicrophone),
        focusEnabled: bool(value.focusEnabled, d.focusEnabled),
        overlayEnabled: bool(value.overlayEnabled, d.overlayEnabled),
        overlaySide: value.overlaySide === 'right' ? 'right' : 'left',
        overlayBlockedHosts: Array.isArray(value.overlayBlockedHosts)
            ? value.overlayBlockedHosts.filter((host): host is string => typeof host === 'string' && !!host.trim()).slice(0, 200).map((host) => host.trim().toLowerCase())
            : [],
        desktopReminders: bool(value.desktopReminders, d.desktopReminders),
        cardOrder: Array.isArray(value.cardOrder)
            ? [...new Set((value.cardOrder as unknown[]).filter((card): card is (typeof BENTO_WIDGET_IDS)[number] =>
                BENTO_WIDGET_IDS.includes(card as (typeof BENTO_WIDGET_IDS)[number])))]
            : [...d.cardOrder],
        featuredCards: Array.isArray(value.featuredCards)
            ? BENTO_WIDGET_IDS.filter((card) => (value.featuredCards as unknown[]).includes(card)).slice(0, 2)
            : [...d.featuredCards],
    }

    // An old backup predates fields the dashboard now relies on, so bring it forward too.
    const legacy = value as { notesEnabled?: unknown; featuredCard?: unknown }
    const migrated = migrateSettings({
        ...settings,
        notesEnabled: legacy.notesEnabled as boolean | undefined,
        featuredCard: typeof legacy.featuredCard === 'string' ? legacy.featuredCard : undefined,
    })
    // cardOrder must stay non-empty: an empty one leaves the dashboard with nothing to render.
    if (!migrated.cardOrder.length) migrated.cardOrder = [...DEFAULT_SETTINGS.cardOrder]
    return migrated
}

function shortcut(entry: Record<string, unknown>): Shortcut | null {
    const url = str(entry.url, 2048)
    if (!safeWebUrl(url)) return null
    const icon = typeof entry.icon === 'string' && entry.icon.startsWith('data:') ? entry.icon : undefined
    return { ...meta(entry), label: str(entry.label, 120) || url, url, ...(icon ? { icon } : {}) }
}

function todo(entry: Record<string, unknown>): Todo | null {
    const text = str(entry.text, 500).trim()
    if (!text) return null
    const repeat = entry.repeat === 'daily' || entry.repeat === 'weekly' ? entry.repeat : 'none'
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(str(entry.dueDate, 10)) ? str(entry.dueDate, 10) : undefined
    return {
        ...meta(entry), text, done: bool(entry.done), pinned: bool(entry.pinned), repeat,
        ...(dueDate ? { dueDate } : {}),
        ...(typeof entry.completedCount === 'number' ? { completedCount: num(entry.completedCount, 0) } : {}),
        ...(typeof entry.lastCompletedAt === 'number' ? { lastCompletedAt: num(entry.lastCompletedAt, 0) } : {}),
    }
}

function note(entry: Record<string, unknown>): Note | null {
    return { ...meta(entry), title: str(entry.title, 120), body: str(entry.body, 100_000), pinned: bool(entry.pinned) }
}

function workspace(entry: Record<string, unknown>): Workspace | null {
    const name = str(entry.name, 80).trim()
    if (!name || !Array.isArray(entry.tabs)) return null
    const tabs = entry.tabs
        .filter(isObject)
        .filter((tab) => safeWebUrl(str(tab.url, 2048)))
        .map((tab) => ({ title: str(tab.title, 300) || str(tab.url, 2048), url: str(tab.url, 2048), pinned: bool(tab.pinned) }))
    if (!tabs.length) return null
    return { ...meta(entry), name, tabs }
}

function screenTimeDay(value: unknown): { totalSeconds: number; domains: Record<string, number>; lastUpdated: number } | null {
    if (!isObject(value) || !isObject(value.domains)) return null
    const domains: Record<string, number> = {}
    for (const [domain, seconds] of Object.entries(value.domains)) {
        if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0) domains[domain.slice(0, 253)] = seconds
    }
    return { totalSeconds: Math.max(0, num(value.totalSeconds, 0)), domains, lastUpdated: num(value.lastUpdated, 0) }
}

/**
 * Decides what of a parsed backup file is safe to write, before anything is deleted. Unknown keys
 * and unusable records are reported rather than imported, and a file with nothing recognizable in
 * it is rejected outright so an unrelated JSON document can't pass as a backup.
 */
export function validateBackup(file: unknown, thisInstallId?: string): BackupReport {
    const unwrapped = readEnvelope(file)
    if (!unwrapped) {
        return { data: {}, schemaVersion: 0, accepted: [], skipped: [], error: "That file doesn't look like a valid backup." }
    }

    const { payload: parsed, schemaVersion, exportedBy, exportedAt } = unwrapped
    const data: Record<string, unknown> = {}
    const accepted: string[] = []
    const skipped: string[] = []

    if (schemaVersion > DATA_SCHEMA_VERSION) {
        skipped.push(`written by a newer version (schema ${schemaVersion}) — unrecognized fields were dropped`)
    }

    for (const key of Object.keys(parsed)) {
        if (!(KNOWN_KEYS as readonly string[]).includes(key) && !SCREENTIME_KEY.test(key)) skipped.push(`unknown key "${key}"`)
    }

    if ('settings' in parsed) {
        data.settings = sanitizeSettings(parsed.settings)
        accepted.push(isObject(parsed.settings) ? 'settings' : 'settings (reset to defaults)')
    }

    const lists = [
        ['shortcuts', 'shortcuts', shortcut],
        ['aiTools', 'AI tools', shortcut],
        ['todos', 'to-dos', todo],
        ['notes', 'notes', note],
        ['workspaces', 'workspaces', workspace],
    ] as const
    for (const [key, label, map] of lists) {
        if (!(key in parsed)) continue
        const list = validList(parsed[key], label, map as (entry: Record<string, unknown>) => unknown, skipped)
        if (list === null) { skipped.push(`${label} (not a list)`); continue }
        data[key] = list
        accepted.push(`${list.length} ${label}`)
    }

    if ('focus' in parsed) {
        const focus = parsed.focus
        const history = isObject(focus) && Array.isArray(focus.history)
            ? focus.history.filter(isObject).map((entry) => ({
                id: id(entry.id), label: str(entry.label, 300), minutes: Math.max(0, num(entry.minutes, 0)),
                completedAt: num(entry.completedAt, 0),
                ...(typeof entry.taskId === 'string' ? { taskId: entry.taskId } : {}),
            }))
            : []
        // A restored session is never resumed mid-flight: the timer it was counting against is gone.
        data.focus = { session: null, history }
        accepted.push(`${history.length} focus sessions`)
    }

    for (const key of ['weather:cache', 'quotes:cache'] as const) {
        if (!(key in parsed)) continue
        // Caches are disposable — drop rather than reject anything malformed, it refetches.
        data[key] = isObject(parsed[key]) ? parsed[key] : null
    }

    if ('backup:lastExport' in parsed) {
        data['backup:lastExport'] = typeof parsed['backup:lastExport'] === 'number' ? parsed['backup:lastExport'] : null
    }

    let screenTimeDays = 0
    for (const [key, value] of Object.entries(parsed)) {
        if (!SCREENTIME_KEY.test(key)) continue
        const day = screenTimeDay(value)
        if (day) { data[key] = day; screenTimeDays++ }
        else skipped.push(`unreadable ${key}`)
    }
    if (screenTimeDays) accepted.push(`${screenTimeDays} days of screen time`)

    if (!accepted.length) {
        return { data: {}, schemaVersion, accepted, skipped, error: 'No Daily Workspace data was found in that file.' }
    }

    // Every record above was validated and repaired against the current shape, so the payload is
    // current by construction — stamp it rather than carrying the file's own (possibly older)
    // marker, which would make `runDataMigration` re-walk data that needs no migrating.
    data.schemaVersion = DATA_SCHEMA_VERSION
    return {
        data, schemaVersion, accepted, skipped,
        ...(exportedBy ? { exportedBy } : {}),
        ...(exportedAt ? { exportedAt } : {}),
        ...(exportedBy && thisInstallId ? { sameInstall: exportedBy.installId === thisInstallId } : {}),
    }
}

/**
 * Unwraps a parsed file into the storage payload plus whatever the file says about itself.
 *
 * Accepts two shapes, which is the whole point: the current envelope, and the bare
 * `chrome.storage.local` dump every backup taken before the envelope existed. A legacy dump reports
 * schema 0, which routes it through the same per-record repair as any other old data.
 */
export function readEnvelope(parsed: unknown): {
    payload: Record<string, unknown>
    schemaVersion: number
    exportedBy?: BackupEnvelope['exportedBy']
    exportedAt?: number
} | null {
    if (!isObject(parsed)) return null

    const looksWrapped = parsed.app === EXPORT_APP_ID && isObject(parsed.data)
    if (looksWrapped) {
        const by = parsed.exportedBy
        return {
            payload: parsed.data as Record<string, unknown>,
            schemaVersion: num(parsed.schemaVersion, 0),
            ...(isObject(by) && typeof by.installId === 'string'
                ? { exportedBy: { installId: by.installId, extensionVersion: str(by.extensionVersion, 32) } }
                : {}),
            ...(typeof parsed.exportedAt === 'number' ? { exportedAt: parsed.exportedAt } : {}),
        }
    }

    // A file claiming to be ours but with no usable payload is a corrupt export, not a flat dump.
    if (parsed.app === EXPORT_APP_ID) return null
    return { payload: parsed, schemaVersion: 0 }
}

/** Builds the file `handleExport` writes. `includeDeviceData` decides whether the `device` tier
 * (screen-time history) rides along: useful for a same-machine restore, meaningless on another. */
export function buildExport(
    stored: Record<string, unknown>,
    options: { extensionVersion: string; installId: string; includeDeviceData: boolean; now?: number },
): BackupEnvelope {
    const data: Record<string, unknown> = {}
    const includes = new Set<string>()
    for (const [key, value] of Object.entries(stored)) {
        const tier = tierFor(key)
        // Unknown keys are left out: exporting something this version cannot describe would make
        // the file's own schemaVersion a lie.
        if (!tier) continue
        if (tier === 'derived') continue
        if (tier === 'device' && (!options.includeDeviceData || key === 'installId')) continue
        data[key] = value
        includes.add(tier)
    }
    return {
        app: EXPORT_APP_ID,
        schemaVersion: DATA_SCHEMA_VERSION,
        exportedAt: options.now ?? Date.now(),
        exportedBy: { extensionVersion: options.extensionVersion, installId: options.installId },
        includes: [...includes].sort(),
        data,
    }
}

export interface MergeSummary {
    /** Final payload to write, existing data included. */
    data: Record<string, unknown>
    /** Per-key description of what the merge did, for the confirmation UI. */
    changes: string[]
    /** Keys the file contained that a merge deliberately will not touch. */
    held: string[]
}

/**
 * Combines a validated backup with what is already stored, instead of replacing it. Lists match on
 * id first and then on content (see DEDUPE_KEYS) so the same task or link carried from another
 * profile updates in place rather than appearing twice; the newer `updatedAt` wins.
 *
 * Settings are not merged — half of one profile's preferences and half of another's is not a state
 * either person chose. An explicit replace is the way to move settings.
 */
export function mergeBackup(existing: Record<string, unknown>, incoming: Record<string, unknown>): MergeSummary {
    const data: Record<string, unknown> = { ...existing }
    const changes: string[] = []
    const held: string[] = []

    for (const [key, value] of Object.entries(incoming)) {
        if (key === 'settings') { held.push('settings (replace-only)'); continue }
        if (!isMergeable(key)) {
            // Screen time is still worth combining per day, just not as a record list.
            if (SCREENTIME_KEY_PATTERN.test(key)) {
                const mine = existing[key]
                data[key] = isObject(mine)
                    ? mergeScreenTimeDay(mine as unknown as ScreenTimeDayLike, value as ScreenTimeDayLike)
                    : value
                continue
            }
            held.push(key)
            continue
        }

        if (key === 'focus') {
            // Focus history is append-only across devices: two machines' completed sessions both
            // happened. The live session is this device's own and is never taken from a file.
            type HistoryEntry = { id: string; completedAt: number }
            const mineHistory: HistoryEntry[] = isObject(existing.focus) && Array.isArray((existing.focus as { history?: unknown }).history)
                ? (existing.focus as { history: HistoryEntry[] }).history
                : []
            const theirs: HistoryEntry[] = (value as { history?: HistoryEntry[] }).history ?? []
            const seen = new Set(mineHistory.map((entry) => entry.id))
            const extra = theirs.filter((entry) => !seen.has(entry.id))
            data.focus = {
                session: isObject(existing.focus) ? (existing.focus as { session: unknown }).session : null,
                history: [...mineHistory, ...extra].sort((a, b) => b.completedAt - a.completedAt).slice(0, 365),
            }
            if (extra.length) changes.push(`${extra.length} focus sessions added`)
            continue
        }

        if (Array.isArray(value)) {
            const mine = Array.isArray(existing[key]) ? (existing[key] as RecordMeta[]) : []
            const result = mergeList(mine, value as RecordMeta[], DEDUPE_KEYS[key])
            data[key] = result.merged
            changes.push(`${key}: ${result.added} added, ${result.updated} updated, ${result.unchanged} already current`)
            continue
        }

        data[key] = value
    }

    return { data, changes, held }
}
