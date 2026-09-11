export interface ScreenTimeDay {
    totalSeconds: number
    domains: Record<string, number>
    lastUpdated: number
}

export function dateKey(date = new Date()): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

export function storageKeyForDate(date = new Date()): string {
    return `screentime:${dateKey(date)}`
}

export async function getScreenTimeDay(date = new Date()): Promise<ScreenTimeDay | null> {
    const result = await chrome.storage.local.get(storageKeyForDate(date))
    return (result[storageKeyForDate(date)] as ScreenTimeDay | undefined) ?? null
}

export async function getScreenTimeRange(days: number): Promise<ScreenTimeDay[]> {
    const keys: string[] = []
    const now = new Date()
    for (let i = 0; i < days; i++) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        keys.push(storageKeyForDate(d))
    }
    const result = await chrome.storage.local.get(keys)
    return keys.map((k) => (result[k] as ScreenTimeDay | undefined) ?? { totalSeconds: 0, domains: {}, lastUpdated: 0 })
}

const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#84cc16']

/** Deterministic so a domain's color never changes between the collapsed card and the expanded modal. */
export function domainColor(domain: string): string {
    let hash = 0
    for (let i = 0; i < domain.length; i++) hash = (hash * 31 + domain.charCodeAt(i)) >>> 0
    return PALETTE[hash % PALETTE.length]
}

export function topDomains(domains: Record<string, number>, limit = 5): [string, number][] {
    const entries = Object.entries(domains).sort((a, b) => b[1] - a[1])
    const top = entries.slice(0, limit)
    const rest = entries.slice(limit)
    const otherSeconds = rest.reduce((sum, [, s]) => sum + s, 0)
    return otherSeconds > 0 ? [...top, ['Other', otherSeconds]] : top
}

export function formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    if (hours === 0) return `${minutes}m`
    return `${hours}h ${minutes}m`
}

/** Registrable-domain normalization: strips protocol/path/www and collapses subdomains (docs.google.com -> google.com). */
export function normalizeDomain(url: string): string | null {
    try {
        const { hostname } = new URL(url)
        const host = hostname.replace(/^www\./, '')
        const parts = host.split('.')
        if (parts.length <= 2) return host
        return parts.slice(-2).join('.')
    } catch {
        return null
    }
}
