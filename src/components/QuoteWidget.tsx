import { useEffect, useState } from 'react'
import { useStorageValue } from '../lib/useStorageValue'

const QUOTE_HOST = 'https://type.fit/*'
const STALE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_LENGTH = 140

function dailyIndex(length: number): number {
    const dayNumber = Math.floor(Date.now() / 86400000)
    return length > 0 ? dayNumber % length : 0
}

export default function QuoteWidget() {
    const [cache, setCache] = useStorageValue('quotes:cache', null)
    const [permission, setPermission] = useState<'checking' | 'granted' | 'denied'>('checking')
    const [error, setError] = useState(false)

    useEffect(() => {
        chrome.permissions.contains({ origins: [QUOTE_HOST] }, (granted) => {
            setPermission(granted ? 'granted' : 'denied')
        })
    }, [])

    useEffect(() => {
        if (permission !== 'granted') return
        if (cache && Date.now() - cache.fetchedAt < STALE_MS) return

        let cancelled = false
        void (async () => {
            try {
                const res = await fetch('https://type.fit/api/quotes', { signal: AbortSignal.timeout(10000) })
                if (!res.ok) throw new Error(String(res.status))
                const data = (await res.json()) as { text: string; author: string | null }[]
                const quotes = data
                    .filter((q) => q.text && q.text.length <= MAX_LENGTH)
                    .map((q) => ({ text: q.text, author: q.author?.replace(/, type\.fit$/, '') || 'Unknown' }))
                if (!cancelled && quotes.length > 0) {
                    setCache({ quotes, fetchedAt: Date.now() })
                    setError(false)
                }
            } catch {
                if (!cancelled) setError(true)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [permission, cache, setCache])

    const enable = () => {
        chrome.permissions.request({ origins: [QUOTE_HOST] }, (granted) => {
            setPermission(granted ? 'granted' : 'denied')
        })
    }

    if (permission === 'checking') return null

    if (permission === 'denied') {
        return (
            <button type="button" onClick={enable} className="text-xs text-neutral-400 underline decoration-dotted">
                Show a daily quote
            </button>
        )
    }

    if (!cache) {
        return (
            <p className="text-xs text-neutral-400">{error ? "Couldn't load a quote." : 'Loading a quote…'}</p>
        )
    }

    const quote = cache.quotes[dailyIndex(cache.quotes.length)]

    return (
        <p className="max-w-md text-center text-sm italic text-neutral-500 dark:text-neutral-400">
            "{quote.text}" <span className="not-italic text-neutral-400 dark:text-neutral-500">— {quote.author}</span>
        </p>
    )
}
