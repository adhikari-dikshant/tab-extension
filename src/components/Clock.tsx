import { useEffect, useState } from 'react'
import AnalogClock from './AnalogClock'
import { DEFAULT_SETTINGS } from '../lib/storage'
import { useStorageValue } from '../lib/useStorageValue'

export default function Clock() {
    const [settings] = useStorageValue('settings', DEFAULT_SETTINGS)
    const [now, setNow] = useState(() => new Date())
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])
    const parts = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit', hour12: settings.clockFormat === '12h' }).formatToParts(now)
    const time = parts.filter(p => p.type !== 'dayPeriod').map(p => p.value).join('').trim()
    const period = parts.find(p => p.type === 'dayPeriod')?.value
    // The date deliberately lives in the Today card rather than here, so the hero reads as "now"
    // and the card reads as "today" instead of both repeating the date.
    return settings.clockStyle === 'analog'
        ? <AnalogClock />
        : <div className="digital-clock"><time dateTime={now.toISOString()}>{time}</time>{period && <span>{period}</span>}</div>
}
