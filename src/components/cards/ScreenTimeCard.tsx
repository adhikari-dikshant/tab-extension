import { useEffect, useState } from 'react'
import { BentoCard } from '../BentoGrid'
import { CardEmpty, CardSkeleton } from '../CardState'
import { Modal } from '../Modal'
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
    const [modalOpen, setModalOpen] = useState(false)
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

    useEffect(() => {
        if (modalOpen && range === 'week' && weekDays === null) {
            getScreenTimeRange(7).then(setWeekDays)
        }
    }, [modalOpen, range, weekDays])

    const enable = () => {
        chrome.permissions.request({ permissions: ['tabs', 'idle'] }, (granted) => {
            setPermission(granted ? 'granted' : 'denied')
            if (granted) setSettings({ ...settings, screenTimeEnabled: true })
        })
    }

    if (permission === 'checking') {
        return (
            <BentoCard title="Screen time">
                <CardSkeleton />
            </BentoCard>
        )
    }

    if (permission === 'denied') {
        return (
            <BentoCard title="Screen time">
                <CardEmpty>
                    <p className="mb-2">
                        See where your time online goes today. Tracking happens locally only — nothing leaves your
                        device.
                    </p>
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

    const displayedTotal = range === 'today' ? totalToday : totalWeek
    const displayedTop = range === 'today' ? topToday : topWeek

    const vsYesterday = yesterday
        ? sumDay(yesterday) === 0
            ? null
            : Math.round(((totalToday - sumDay(yesterday)) / sumDay(yesterday)) * 100)
        : null

    return (
        <>
            <button type="button" onClick={() => setModalOpen(true)} className="block w-full text-left">
                <BentoCard title="Screen time">
                    {today === null ? (
                        <CardSkeleton />
                    ) : (
                        <div className="space-y-2">
                            <p className="text-2xl font-light">{formatDuration(totalToday)}</p>
                            <SegmentedBar domains={topToday} total={totalToday} />
                        </div>
                    )}
                </BentoCard>
            </button>

            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Screen time"
                headerActions={
                    <div className="flex rounded-full border border-black/10 p-0.5 text-xs dark:border-white/10">
                        {(['today', 'week'] as const).map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setRange(r)}
                                className={`rounded-full px-2.5 py-1 capitalize ${
                                    range === r ? 'bg-black text-white dark:bg-white dark:text-black' : ''
                                }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                }
            >
                <div className="space-y-4">
                    {range === 'week' && weekDays === null ? (
                        <CardSkeleton />
                    ) : (
                        <>
                            <div>
                                <p className="text-3xl font-light">{formatDuration(displayedTotal)}</p>
                                {range === 'today' && vsYesterday !== null && (
                                    <p className="text-xs text-neutral-400">
                                        {vsYesterday <= 0 ? '↓' : '↑'} {Math.abs(vsYesterday)}% vs yesterday
                                    </p>
                                )}
                            </div>

                            <SegmentedBar domains={displayedTop} total={displayedTotal} />

                            {displayedTotal === 0 ? (
                                <CardEmpty>No activity tracked yet for this period.</CardEmpty>
                            ) : (
                                <ul className="space-y-1.5">
                                    {displayedTop.map(([domain, seconds]) => (
                                        <li key={domain} className="flex items-center gap-2 text-sm">
                                            <span
                                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                style={{ backgroundColor: domainColor(domain) }}
                                            />
                                            <span className="min-w-0 flex-1 truncate">{domain}</span>
                                            <span className="text-neutral-400">{formatDuration(seconds)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    )}
                </div>
            </Modal>
        </>
    )
}
