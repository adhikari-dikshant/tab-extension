import type { SearchEngine } from './storage'

export type ParsedCommand =
    | { type: 'todo'; text: string }
    | { type: 'bookmark'; title: string }
    | { type: 'shortcut'; name: string }
    | { type: 'search'; query: string }

export function parseCommand(input: string): ParsedCommand | null {
    const trimmed = input.trim()
    if (!trimmed) return null

    if (trimmed.startsWith('t:')) {
        const text = trimmed.slice(2).trim()
        return text ? { type: 'todo', text } : null
    }

    if (trimmed.startsWith('b:')) {
        const title = trimmed.slice(2).trim()
        return title ? { type: 'bookmark', title } : null
    }

    if (trimmed.startsWith('@')) {
        const name = trimmed.slice(1).trim()
        return name ? { type: 'shortcut', name } : null
    }

    return { type: 'search', query: trimmed }
}

const SEARCH_ENGINE_URLS: Record<SearchEngine, string> = {
    google: 'https://www.google.com/search?q=',
    duckduckgo: 'https://duckduckgo.com/?q=',
    bing: 'https://www.bing.com/search?q=',
    brave: 'https://search.brave.com/search?q=',
    youtube: 'https://www.youtube.com/results?search_query=',
    wikipedia: 'https://en.wikipedia.org/w/index.php?search=',
}

export function searchUrl(engine: SearchEngine, query: string): string {
    return SEARCH_ENGINE_URLS[engine] + encodeURIComponent(query)
}

/** A bare URL or "www.x" typed with no prefix navigates directly instead of searching for it. */
export function directUrlFor(query: string): string | null {
    const trimmed = query.trim()
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    if (/^www\.[^\s]+\.[a-z]{2,}([/?#].*)?$/i.test(trimmed)) return `https://${trimmed}`
    return null
}

/** "b: github.com My code" -> bookmark that URL titled "My code". "b: something" with no
 * domain-looking token falls back to bookmarking a search-results page for that text. */
export function parseBookmarkTarget(text: string): { url: string; title: string } {
    const [first, ...rest] = text.split(' ')
    const restTitle = rest.join(' ').trim()
    const looksLikeUrl = /^https?:\/\//i.test(first) || /\.[a-z]{2,}$/i.test(first)

    if (looksLikeUrl) {
        const url = /^https?:\/\//i.test(first) ? first : `https://${first}`
        return { url, title: restTitle || first }
    }

    return { url: searchUrl('google', text), title: text }
}
