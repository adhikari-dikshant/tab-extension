import type { SearchEngine } from './storage'

/** The host permission each engine's native suggest API needs (none listed = no permission
 * required, either because it sends CORS headers itself or it has no dedicated endpoint). */
const SUGGEST_HOST_PERMISSION: Partial<Record<SearchEngine, string>> = {
    google: 'https://www.google.com/*',
    duckduckgo: 'https://duckduckgo.com/*',
    bing: 'https://www.bing.com/*',
    brave: 'https://search.brave.com/*',
    youtube: 'https://www.google.com/*',
}

const SUGGEST_URL: Partial<Record<SearchEngine, (q: string) => string>> = {
    google: (q) => `https://www.google.com/complete/search?client=chrome&q=${encodeURIComponent(q)}`,
    duckduckgo: (q) => `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`,
    bing: (q) => `https://www.bing.com/osjson.aspx?query=${encodeURIComponent(q)}`,
    brave: (q) => `https://search.brave.com/api/suggest?q=${encodeURIComponent(q)}`,
    youtube: (q) => `https://www.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(q)}`,
}

// Wikipedia's opensearch API sends Access-Control-Allow-Origin itself, so it needs no extra
// permission — used as the always-available fallback source for every other engine too.
const WIKIPEDIA_SUGGEST = (q: string) =>
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&format=json&origin=*`

export function hostPermissionFor(engine: SearchEngine): string | null {
    return SUGGEST_HOST_PERMISSION[engine] ?? null
}

export async function hasSuggestPermission(engine: SearchEngine): Promise<boolean> {
    const origin = hostPermissionFor(engine)
    if (!origin) return true
    return new Promise((resolve) => chrome.permissions.contains({ origins: [origin] }, resolve))
}

export async function requestSuggestPermission(engine: SearchEngine): Promise<boolean> {
    const origin = hostPermissionFor(engine)
    if (!origin) return true
    return new Promise((resolve) => chrome.permissions.request({ origins: [origin] }, resolve))
}

/** Both the native per-engine endpoints and Wikipedia's opensearch return
 * [query, [suggestion, ...], ...] — a single parser covers all of them. */
async function fetchSuggestList(url: string, signal: AbortSignal): Promise<string[]> {
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as unknown
    return Array.isArray(data) && Array.isArray(data[1]) ? (data[1] as string[]) : []
}

/** Uses the engine's own suggest API when permission is already granted; otherwise falls back
 * to Wikipedia's (permission-free) suggestions so results are never blocked on a permission
 * prompt the user hasn't opted into yet. */
export async function fetchSuggestions(engine: SearchEngine, query: string, signal: AbortSignal): Promise<string[]> {
    if (!query.trim()) return []

    const nativeUrl = SUGGEST_URL[engine]
    if (nativeUrl && (await hasSuggestPermission(engine))) {
        try {
            return await fetchSuggestList(nativeUrl(query), signal)
        } catch {
            // fall through to Wikipedia
        }
    }

    try {
        return await fetchSuggestList(WIKIPEDIA_SUGGEST(query), signal)
    } catch {
        return []
    }
}
