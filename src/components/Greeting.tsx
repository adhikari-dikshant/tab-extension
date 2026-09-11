import { DEFAULT_SETTINGS } from '../lib/storage'
import { useStorageValue } from '../lib/useStorageValue'

function timeOfDayGreeting(): string {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
}

export default function Greeting() {
    const [settings] = useStorageValue('settings', DEFAULT_SETTINGS)
    const dateLabel = new Date().toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    })

    return (
        <div className="text-center">
            <p className="text-lg text-neutral-600 dark:text-neutral-300">
                {timeOfDayGreeting()}
                {settings.greetingName ? `, ${settings.greetingName}` : ''}
            </p>
            <p className="text-sm text-neutral-400 dark:text-neutral-500">{dateLabel}</p>
        </div>
    )
}
