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
    return <>
        {settings.clockStyle === 'analog' ? <AnalogClock /> : <div className="digital-clock"><time dateTime={now.toISOString()}>{time}</time>{period && <span>{period}</span>}</div>}
        <p className="clock-date">{now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</p>
    </>
}
