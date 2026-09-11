import { useEffect, useState } from 'react'
import AnalogClock from './AnalogClock'
import { DEFAULT_SETTINGS } from '../lib/storage'
import { useStorageValue } from '../lib/useStorageValue'

export default function Clock() {
    const [settings] = useStorageValue('settings', DEFAULT_SETTINGS)
    const [now, setNow] = useState(() => new Date())
    const isAnalog = settings.clockStyle === 'analog'

    useEffect(() => {
        if (isAnalog) return
        const id = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(id)
    }, [isAnalog])

    if (isAnalog) return <AnalogClock />

    const time = now.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: settings.clockFormat === '12h',
    })

    return <span className="text-2xl font-light tabular-nums text-neutral-600 dark:text-neutral-300">{time}</span>
}
