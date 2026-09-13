import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS } from '../lib/storage'
import { useStorageValue } from '../lib/useStorageValue'

export default function Greeting() {
    const [settings] = useStorageValue('settings', DEFAULT_SETTINGS)
    const [hour, setHour] = useState(() => new Date().getHours())
    useEffect(() => {
        const timer = setInterval(() => setHour(new Date().getHours()), 60_000)
        return () => clearInterval(timer)
    }, [])
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
    return <h1 title={`${greeting}${settings.greetingName ? `, ${settings.greetingName}` : ''}`}>{greeting}{settings.greetingName ? <>, <span>{settings.greetingName}</span></> : <span className="greeting-period">.</span>}</h1>
}
