export type SearchEngine = 'google' | 'duckduckgo' | 'bing' | 'brave' | 'youtube' | 'wikipedia'
export type ClockFormat = '12h' | '24h'
export type ClockStyle = 'digital' | 'analog'
export type TempUnit = 'celsius' | 'fahrenheit'
export type Theme = 'system' | 'light' | 'dark'

export const BENTO_WIDGET_IDS = ['shortcuts', 'todo', 'screentime', 'mostVisited', 'notes'] as const
export const PAGE_WIDGET_IDS = [
    'clock',
    'weather',
    'customText',
    'greeting',
    'quotes',
    'bookmarks',
    'googleApps',
    'aiTools',
    'recentlyClosed',
    'workspaces',
] as const
export const WIDGET_IDS = [...BENTO_WIDGET_IDS, ...PAGE_WIDGET_IDS] as const
export type WidgetId = (typeof WIDGET_IDS)[number]

export const WIDGET_LABELS: Record<WidgetId, string> = {
    shortcuts: 'Shortcuts',
    todo: 'To-do',
    screentime: 'Screen time',
    mostVisited: 'Most visited',
    notes: 'Notes',
    clock: 'Clock',
    weather: 'Weather',
    customText: 'Custom text',
    greeting: 'Greeting',
    quotes: 'Motivational quotes',
    bookmarks: 'Bookmarks',
    googleApps: 'Google apps',
    aiTools: 'AI tools',
    recentlyClosed: 'Recently closed tabs',
    workspaces: 'Saved workspaces',
}

export const ACCENT_PRESETS = [
    '#ef4444',
    '#f97316',
    '#22c55e',
    '#14b8a6',
    '#3b82f6',
    '#ec4899',
    '#a855f7',
    '#f59e0b',
    '#64748b',
] as const

/** Bumped whenever stored settings need reshaping; see `migrateSettings`. */
export const SETTINGS_VERSION = 3

export interface Settings {
    settingsVersion: number
    theme: Theme
    accentColor: string
    opacity: number
    searchEngine: SearchEngine
    hideSearchEngines: boolean
    greetingName: string
    customText: string
    clockFormat: ClockFormat
    clockStyle: ClockStyle
    tempUnit: TempUnit
    location: { lat: number; lon: number; label: string } | 'auto'
    wallpaper: { type: 'upload' | 'daily-random' | 'none'; value: string | null }
    adaptiveIcons: boolean
    widgetsEnabled: WidgetId[]
    language: string
    screenTimeEnabled: boolean
    searchSuggestionsEnabled: boolean
    hideMicrophone: boolean
    focusEnabled: boolean
    /** Floating task/note bubble and focus timer on ordinary web pages. Off until the user grants
     * the host permission it needs; see `overlay.ts`. */
    overlayEnabled: boolean
    /** Which edge the collapsed bubble sits on, so it can be moved off whatever a site puts there. */
    overlaySide: 'left' | 'right'
    /** Hosts the overlay stays out of, for pages where any chrome is unwelcome. */
    overlayBlockedHosts: string[]
    desktopReminders: boolean
    cardOrder: (typeof BENTO_WIDGET_IDS)[number][]
    /** Up to two cards given double height. Replaces the single `featuredCard` of v1. */
    featuredCards: (typeof BENTO_WIDGET_IDS)[number][]
}

export interface QuoteCache {
    quotes: { text: string; author: string }[]
    fetchedAt: number
}

/**
 * Where a record came from. Set when something is captured from a real page (the global capture
 * commands in `background/capture.ts`); absent for anything typed straight into the dashboard,
 * which has no source page to point at.
 */
export interface Source {
    url: string
    title?: string
    /** When the capture happened, which can predate the record's own edits. */
    capturedAt: number
}

/** Fields every stored record carries, so merge-on-import can resolve conflicts by recency and
 * exports stay meaningful after a round trip through another browser profile. */
export interface RecordMeta {
    id: string
    createdAt: number
    updatedAt: number
    source?: Source
}

export interface Shortcut extends RecordMeta {
    label: string
    url: string
    /** A user-uploaded custom icon (data URL) only. Absent means derive the icon from `url` at
     * render time via ShortcutIcon's fallback chain (cached favicon -> Google favicon -> letter). */
    icon?: string
}

export interface Todo extends RecordMeta {
    text: string
    done: boolean
    pinned: boolean
    dueDate?: string
    repeat?: 'none' | 'daily' | 'weekly'
    completedCount?: number
    lastCompletedAt?: number
    reminderFor?: string
}

/** Screen-time shape as the merge and backup layers see it, without importing from screentime.ts
 * (which reaches for chrome.storage and is not safe to pull into pure logic). */
export interface ScreenTimeDayLike {
    totalSeconds: number
    domains: Record<string, number>
    lastUpdated: number
}

export interface WeatherCache {
    fetchedAt: number
    location: { lat: number; lon: number; label: string }
    current: {
        temperatureC: number
        feelsLikeC: number
        humidity: number
        conditionCode: number
        maxC: number
        minC: number
    }
}

export interface Note extends RecordMeta { title: string; body: string; pinned: boolean }
export interface Workspace extends RecordMeta { name: string; tabs: { title: string; url: string; pinned: boolean }[] }
export interface FocusSession {
    id: string; taskId?: string; label: string; mode: 'focus' | 'break'; durationMs: number
    remainingMs: number; endsAt: number | null; status: 'running' | 'paused' | 'finished'
}
export interface FocusState {
    session: FocusSession | null
    history: { id: string; taskId?: string; label: string; minutes: number; completedAt: number }[]
}

/**
 * Version of the stored *data* (records and their fields), as opposed to SETTINGS_VERSION which
 * covers UI preferences only. Export files carry this so an importer knows how to read them, and
 * `migrateData` brings older stored records up to it on load.
 */
export const DATA_SCHEMA_VERSION = 1

/** Identifies an export file as ours, so an unrelated JSON document can't be mistaken for one. */
export const EXPORT_APP_ID = 'daily-workspace'

export interface StorageSchema {
    notes: Note[]
    workspaces: Workspace[]
    focus: FocusState
    settings: Settings
    shortcuts: Shortcut[]
    aiTools: Shortcut[]
    todos: Todo[]
    'weather:cache': WeatherCache | null
    'quotes:cache': QuoteCache | null
    'backup:lastExport': number | null
    /** Collapsed/expanded state of the page overlay, kept out of `settings` so toggling it on every
     * page does not rewrite the settings object the whole dashboard subscribes to. */
    'overlay:open': 'todo' | 'notes' | null
    /** Stamped by `migrateData`; absent means data predates versioning. */
    schemaVersion: number
    /** Random per-installation id. Used to label exports with their origin so a merge can tell
     * "this file came from somewhere else" from "this is my own backup". Never sent anywhere. */
    installId: string
}

/**
 * Which storage tier each key belongs to, and why. Everything currently lives in
 * `chrome.storage.local`; this table is the boundary the tiers are *enforced* at rather than a
 * promise to move keys later.
 *
 *   portable  Belongs to the person, not the machine. Safe to carry to another browser profile,
 *             so it is exported by default and merged on import.
 *   device    Only means something on the machine that produced it (screen time is the whole of
 *             this tier) or is cheap to rebuild. Excluded from a portable export, and never
 *             merged in from another install, because doing so would invent history that did not
 *             happen on this device.
 *   derived   Caches and bookkeeping. Refetched or recomputed; never worth importing.
 *
 * `chrome.storage.sync` is deliberately unused: its 100KB total / 8KB-per-item quota cannot hold
 * note bodies or screen-time history, and the `device` tier should not sync by definition. The
 * export file is the portability mechanism instead.
 */
export type StorageTier = 'portable' | 'device' | 'derived'

export const STORAGE_TIERS: Record<string, StorageTier> = {
    settings: 'portable',
    todos: 'portable',
    notes: 'portable',
    shortcuts: 'portable',
    aiTools: 'portable',
    workspaces: 'portable',
    focus: 'portable',
    schemaVersion: 'portable',
    'overlay:open': 'derived',
    installId: 'device',
    'weather:cache': 'derived',
    'quotes:cache': 'derived',
    'backup:lastExport': 'derived',
}

/** Screen-time keys are dated (`screentime:2026-09-14`), so they are matched rather than listed. */
export const SCREENTIME_KEY_PATTERN = /^screentime:\d{4}-\d{2}-\d{2}$/

export function tierFor(key: string): StorageTier | undefined {
    if (SCREENTIME_KEY_PATTERN.test(key)) return 'device'
    return STORAGE_TIERS[key]
}

export const DEFAULT_SETTINGS: Settings = {
    settingsVersion: SETTINGS_VERSION,
    theme: 'light',
    accentColor: ACCENT_PRESETS[4],
    opacity: 100,
    searchEngine: 'google',
    hideSearchEngines: false,
    greetingName: '',
    customText: '',
    clockFormat: '12h',
    clockStyle: 'digital',
    tempUnit: 'celsius',
    location: 'auto',
    wallpaper: { type: 'none', value: null },
    adaptiveIcons: false,
    widgetsEnabled: [...WIDGET_IDS],
    language: 'en',
    screenTimeEnabled: false,
    searchSuggestionsEnabled: true,
    hideMicrophone: false,
    focusEnabled: true,
    overlayEnabled: true,
    overlaySide: 'left',
    overlayBlockedHosts: [],
    desktopReminders: false,
    // To-do and Notes lead, so they are the pair that gets the height; the compact cards fill
    // around them. See `computeLayout`.
    cardOrder: ['todo', 'notes', 'screentime', 'shortcuts', 'mostVisited'],
    featuredCards: ['todo', 'notes'],
}

/** Base metadata for a brand-new record. Every factory below goes through this so no creation
 * site can forget a timestamp and quietly break merge-on-import's recency comparison. */
function newRecord(now = Date.now()): RecordMeta {
    return { id: crypto.randomUUID(), createdAt: now, updatedAt: now }
}

export function createShortcut(label: string, url: string, extra: Partial<Shortcut> = {}): Shortcut {
    return { ...newRecord(), label, url, ...extra }
}

export function createTodo(text: string, extra: Partial<Todo> = {}): Todo {
    return { ...newRecord(), text, done: false, pinned: false, repeat: 'none', ...extra }
}

export function createNote(extra: Partial<Note> = {}): Note {
    return { ...newRecord(), title: '', body: '', pinned: false, ...extra }
}

export function createWorkspace(name: string, tabs: Workspace['tabs'], extra: Partial<Workspace> = {}): Workspace {
    return { ...newRecord(), name, tabs, ...extra }
}

/** Marks a record as just-edited. Required on every mutation: merge-on-import resolves conflicts
 * by `updatedAt`, so an edit that doesn't bump it loses to a stale copy from another profile. */
export function touch<T extends RecordMeta>(record: T, now = Date.now()): T {
    return { ...record, updatedAt: now }
}

export function createDefaultShortcuts(): Shortcut[] {
    return [
        createShortcut('YouTube', 'https://youtube.com'),
        createShortcut('Gmail', 'https://mail.google.com'),
        createShortcut('Drive', 'https://drive.google.com'),
        createShortcut('GitHub', 'https://github.com'),
    ]
}

export function createDefaultAiTools(): Shortcut[] {
    return [
        createShortcut('ChatGPT', 'https://chat.openai.com'),
        createShortcut('Gemini', 'https://gemini.google.com'),
        createShortcut('Copilot', 'https://copilot.microsoft.com'),
        createShortcut('Claude', 'https://claude.ai'),
        createShortcut('DeepSeek', 'https://chat.deepseek.com'),
        createShortcut('Perplexity', 'https://www.perplexity.ai'),
        createShortcut('Grok', 'https://grok.com'),
        createShortcut('Mistral', 'https://chat.mistral.ai'),
    ]
}

export async function ensureDefaultAiTools(): Promise<void> {
    const result = await chrome.storage.local.get('aiTools')
    if (result.aiTools === undefined) {
        await chrome.storage.local.set({ aiTools: createDefaultAiTools() })
    }
}

export function faviconFor(url: string): string {
    try {
        const { hostname } = new URL(url)
        return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
    } catch {
        return ''
    }
}

/** A random id for this installation, created on first use. Lets an export record where it came
 * from so a merge can distinguish another profile's file from this device's own backup. */
export async function ensureInstallId(): Promise<string> {
    const result = await chrome.storage.local.get('installId')
    const existing = result.installId as string | undefined
    if (existing) return existing
    const installId = crypto.randomUUID()
    await chrome.storage.local.set({ installId })
    return installId
}

export async function ensureDefaultShortcuts(): Promise<void> {
    const result = await chrome.storage.local.get('shortcuts')
    if (result.shortcuts === undefined) {
        await chrome.storage.local.set({ shortcuts: createDefaultShortcuts() })
    }
}

export async function getStorageValue<K extends keyof StorageSchema>(
    key: K,
): Promise<StorageSchema[K] | undefined> {
    const result = await chrome.storage.local.get(key)
    return result[key] as StorageSchema[K] | undefined
}

export async function setStorageValue<K extends keyof StorageSchema>(
    key: K,
    value: StorageSchema[K],
): Promise<void> {
    await chrome.storage.local.set({ [key]: value })
}

export function onStorageValueChanged<K extends keyof StorageSchema>(
    key: K,
    callback: (newValue: StorageSchema[K] | undefined) => void,
): () => void {
    const listener = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: chrome.storage.AreaName,
    ) => {
        if (areaName !== 'local') return
        if (!(key in changes)) return
        callback(changes[key].newValue as StorageSchema[K] | undefined)
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
}
