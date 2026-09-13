import { useEffect, useState } from 'react'
import { useStorageValue } from '../lib/useStorageValue'

const QUOTE_HOST = 'https://type.fit/*'
const STALE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_LENGTH = 140

// Original daily reflections keep the widget useful offline and before network access is granted.
const DAILY_QUOTES = [
    'Small steps, taken with care, can change the shape of a day.',
    'Give your best attention to what matters most today.',
    'Leave a little room in your plans for something wonderful.',
    'Progress begins with the next small thing you choose to do.',
    'A moment of curiosity can open a whole new direction.',
    'Make time for the work you love and the people who matter.',
    'You do not need to finish everything to make today meaningful.',
]

function localDayNumber(): number {
    const now = new Date()
    return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000)
}

export default function QuoteWidget() {
    const [cache, setCache] = useStorageValue('quotes:cache', null)
    const [permission, setPermission] = useState<'checking' | 'granted' | 'denied'>('checking')
    const [dayNumber, setDayNumber] = useState(localDayNumber)

    useEffect(() => {
        const timer = setInterval(() => setDayNumber(localDayNumber()), 60_000)
        return () => clearInterval(timer)
    }, [])

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
                }
            } catch {
                // Keep showing the cached quote or bundled daily reflection when offline.
            }
        })()
        return () => {
            cancelled = true
        }
    }, [permission, cache, setCache])

    const quotes = cache?.quotes.length ? cache.quotes : DAILY_QUOTES.map((text) => ({ text, author: '' }))
    const quote = quotes[dayNumber % quotes.length]
    const label = quote.author ? `${quote.text} — ${quote.author}` : quote.text

    return (
        <p title={label} aria-label={`Daily quote: ${label}`} className="welcome-subtitle daily-quote">
            “{quote.text}”{quote.author && <span> — {quote.author}</span>}
        </p>
    )
}
