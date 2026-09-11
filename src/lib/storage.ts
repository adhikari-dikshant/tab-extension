export type SearchEngine = 'google' | 'duckduckgo' | 'bing' | 'brave' | 'youtube' | 'wikipedia'
export type ClockFormat = '12h' | '24h'
export type ClockStyle = 'digital' | 'analog'
export type TempUnit = 'celsius' | 'fahrenheit'
export type Theme = 'system' | 'light' | 'dark'

export const BENTO_WIDGET_IDS = ['shortcuts', 'todo', 'weather', 'screentime'] as const
export const PAGE_WIDGET_IDS = ['clock', 'customText', 'greeting', 'quotes', 'bookmarks', 'googleApps', 'aiTools'] as const
export const WIDGET_IDS = [...BENTO_WIDGET_IDS, ...PAGE_WIDGET_IDS] as const
export type WidgetId = (typeof WIDGET_IDS)[number]

export const WIDGET_LABELS: Record<WidgetId, string> = {
    shortcuts: 'Shortcuts',
    todo: 'To-do',
    weather: 'Weather',
    screentime: 'Screen time',
    clock: 'Clock',
    customText: 'Custom text',
    greeting: 'Greeting',
    quotes: 'Motivational quotes',
    bookmarks: 'Bookmarks',
    googleApps: 'Google apps',
    aiTools: 'AI tools',
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

export interface Settings {
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
}

export interface QuoteCache {
    quotes: { text: string; author: string }[]
    fetchedAt: number
}

export interface Shortcut {
    id: string
    label: string
    url: string
    /** A user-uploaded custom icon (data URL) only. Absent means derive the icon from `url` at
     * render time via ShortcutIcon's fallback chain (cached favicon -> Google favicon -> letter). */
    icon?: string
}

export interface Todo {
    id: string
    text: string
    done: boolean
    pinned: boolean
    createdAt: number
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

export interface StorageSchema {
    settings: Settings
    shortcuts: Shortcut[]
    aiTools: Shortcut[]
    todos: Todo[]
    'weather:cache': WeatherCache | null
    'quotes:cache': QuoteCache | null
    'backup:lastExport': number | null
}

export const DEFAULT_SETTINGS: Settings = {
    theme: 'system',
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
}

export function createDefaultShortcuts(): Shortcut[] {
    return [
        { id: crypto.randomUUID(), label: 'YouTube', url: 'https://youtube.com' },
        { id: crypto.randomUUID(), label: 'Gmail', url: 'https://mail.google.com' },
        { id: crypto.randomUUID(), label: 'Drive', url: 'https://drive.google.com' },
        { id: crypto.randomUUID(), label: 'GitHub', url: 'https://github.com' },
    ]
}

export function createDefaultAiTools(): Shortcut[] {
    return [
        { id: crypto.randomUUID(), label: 'ChatGPT', url: 'https://chat.openai.com' },
        { id: crypto.randomUUID(), label: 'Gemini', url: 'https://gemini.google.com' },
        { id: crypto.randomUUID(), label: 'Copilot', url: 'https://copilot.microsoft.com' },
        { id: crypto.randomUUID(), label: 'Claude', url: 'https://claude.ai' },
        { id: crypto.randomUUID(), label: 'DeepSeek', url: 'https://chat.deepseek.com' },
        { id: crypto.randomUUID(), label: 'Perplexity', url: 'https://www.perplexity.ai' },
        { id: crypto.randomUUID(), label: 'Grok', url: 'https://grok.com' },
        { id: crypto.randomUUID(), label: 'Mistral', url: 'https://chat.mistral.ai' },
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
