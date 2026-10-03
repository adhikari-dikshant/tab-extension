import { TimerIcon as Timer } from '@phosphor-icons/react/dist/csr/Timer'
import { useEffect, useState } from 'react'
import { BentoCard } from '../BentoGrid'
import { CardEmpty, CardSkeleton } from '../CardState'
import {
    domainColor,
    formatDuration,
    getScreenTimeDay,
    getScreenTimeRange,
    topDomains,
    type ScreenTimeDay,
} from '../../lib/screentime'
import { DEFAULT_SETTINGS } from '../../lib/storage'
import { useStorageValue } from '../../lib/useStorageValue'

function SegmentedBar({ domains, total }: { domains: [string, number][]; total: number }) {
    if (total === 0) {
        return <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10" />
    }
    return (
        <div className="flex h-2 w-full overflow-hidden rounded-full">
            {domains.map(([domain, seconds]) => (
                <div
                    key={domain}
                    style={{ width: `${(seconds / total) * 100}%`, backgroundColor: domainColor(domain) }}
                />
            ))}
        </div>
    )
}

function sumDay(day: ScreenTimeDay | null) {
    return day?.totalSeconds ?? 0
}

function mergeDomains(days: ScreenTimeDay[]): Record<string, number> {
    const merged: Record<string, number> = {}
    for (const day of days) {
        for (const [domain, seconds] of Object.entries(day.domains)) {
            merged[domain] = (merged[domain] ?? 0) + seconds
        }
    }
    return merged
}

export default function ScreenTimeCard() {
    const [settings, setSettings] = useStorageValue('settings', DEFAULT_SETTINGS)
    const [permission, setPermission] = useState<'checking' | 'granted' | 'denied'>('checking')
    const [today, setToday] = useState<ScreenTimeDay | null>(null)
    const [range, setRange] = useState<'today' | 'week'>('today')
    const [weekDays, setWeekDays] = useState<ScreenTimeDay[] | null>(null)
    const [yesterday, setYesterday] = useState<ScreenTimeDay | null>(null)

    useEffect(() => {
        chrome.permissions.contains({ permissions: ['tabs', 'idle'] }, (granted) => {
            setPermission(granted ? 'granted' : 'denied')
        })
    }, [])

    useEffect(() => {
        if (permission !== 'granted') return
        getScreenTimeDay().then(setToday)
        const yesterdayDate = new Date()
        yesterdayDate.setDate(yesterdayDate.getDate() - 1)
        getScreenTimeDay(yesterdayDate).then(setYesterday)
    }, [permission])

    // Fetched when the week view is first asked for, then kept — seven days of reads is not worth
    // repeating every time the toggle flips back and forth.
    useEffect(() => {
        if (range === 'week' && weekDays === null) getScreenTimeRange(7).then(setWeekDays)
    }, [range, weekDays])

    const enable = () => {
        chrome.permissions.request({ permissions: ['tabs', 'idle'] }, (granted) => {
            setPermission(granted ? 'granted' : 'denied')
            if (granted) setSettings({ ...settings, screenTimeEnabled: true })
        })
    }

    if (permission === 'checking') {
        return (
            <BentoCard title="Screen time" className="screentime-card">
                <CardSkeleton />
            </BentoCard>
        )
    }

    if (permission === 'denied') {
        return (
            <BentoCard title="Screen time" className="screentime-card">
                <CardEmpty>
                    <span className="empty-illustration"><Timer size={25} /></span><strong>Make time for what matters.</strong><p className="mb-2">Understand your day. Private by default.</p>
                    <button
                        type="button"
                        onClick={enable}
                        className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-black"
                    >
                        Turn on screen time
                    </button>
                </CardEmpty>
            </BentoCard>
        )
    }

    const totalToday = sumDay(today)
    const topToday = topDomains(today?.domains ?? {})

    const totalWeek = weekDays ? weekDays.reduce((sum, d) => sum + d.totalSeconds, 0) : 0
    const topWeek = weekDays ? topDomains(mergeDomains(weekDays)) : []

    const vsYesterday = yesterday
        ? sumDay(yesterday) === 0
            ? null
            : Math.round(((totalToday - sumDay(yesterday)) / sumDay(yesterday)) * 100)
        : null

    const displayedTotal = range === 'today' ? totalToday : totalWeek
    const displayedTop = range === 'today' ? topToday : topWeek
    const loadingWeek = range === 'week' && weekDays === null

    return (
        <BentoCard
            title="Screen time"
            className="screentime-card"
            action={
                <div className="screen-range" role="group" aria-label="Screen time period">
                    {(['today', 'week'] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setRange(option)}
                            aria-pressed={range === option}
                        >
                            {option === 'today' ? 'Day' : 'Week'}
                        </button>
                    ))}
                </div>
            }
        >
            {loadingWeek ? <CardSkeleton /> : (
                <div className="screen-content">
                    <div className="screen-headline">
                        <p className="screen-total">{formatDuration(displayedTotal)}</p>
                        {range === 'today' && vsYesterday !== null && (
                            <span className={`screen-delta ${vsYesterday <= 0 ? 'is-down' : 'is-up'}`}>
                                {vsYesterday <= 0 ? '↓' : '↑'} {Math.abs(vsYesterday)}% vs yesterday
                            </span>
                        )}
                        {range === 'week' && <span className="screen-label">across 7 days</span>}
                    </div>

                    <SegmentedBar domains={displayedTop} total={displayedTotal} />

                    {displayedTotal === 0 ? (
                        <p className="screen-label">Your activity will appear here.</p>
                    ) : (
                        /* The full breakdown lives on the card: these are the numbers the card is
                           for, and a tap-through to read them was the whole friction. */
                        <ul className="screen-breakdown themed-scrollbar">
                            {displayedTop.map(([domain, seconds]) => (
                                <li key={domain}>
                                    <i style={{ backgroundColor: domainColor(domain) }} />
                                    <span className="screen-domain">{domain}</span>
                                    <span className="screen-duration tabular-nums">{formatDuration(seconds)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </BentoCard>
    )
}
