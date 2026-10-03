import { useEffect, useState, type CSSProperties } from 'react'
import { MapPinIcon } from '@phosphor-icons/react/dist/csr/MapPin'
import { ArrowClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowClockwise'
import { DEFAULT_SETTINGS } from '../lib/storage'
import { useStorageValue } from '../lib/useStorageValue'
import { describeCode, toDisplayTemp, useWeather } from '../lib/useWeather'

/**
 * The date and the current temperature, shown in the "now" tile beside the clock.
 *
 * They belong together because they answer the same question — what today is like — and the strip
 * already holds the other "right now" facts. Keeping them here rather than in a card also means the
 * grid below is entirely things you act on.
 *
 * The detailed forecast remains available in the tooltip, so this stays a calm glanceable summary.
 */

type Sky = 'clear' | 'cloud' | 'rain' | 'snow' | 'storm' | 'unknown'

function skyFor(code: number): Sky {
    if (code <= 1) return 'clear'
    if (code <= 48) return 'cloud'
    if (code >= 71 && code <= 77) return 'snow'
    if (code >= 95) return 'storm'
    if (code >= 51) return 'rain'
    return 'unknown'
}

// On the minute: a tab left open overnight should roll over rather than show yesterday.
function useMinute() {
    const [now, setNow] = useState(() => new Date())
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60_000)
        return () => clearInterval(timer)
    }, [])
    return now
}

export function TodayDate() {
    const now = useMinute()
    const weekday = now.toLocaleDateString([], { weekday: 'long' })
    const dayMonth = now.toLocaleDateString([], { day: 'numeric', month: 'short' })
    const minutes = now.getHours() * 60 + now.getMinutes()
    const dayProgress = minutes / 1440
    const percent = Math.round(dayProgress * 100)

    return (
        <div className="today">
            <time className="today-date" dateTime={now.toISOString()}>
                <span>{weekday}</span>
                {dayMonth}
            </time>
            <div
                className="day-progress"
                role="progressbar"
                aria-label="Day progress"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                title={`${percent}% of the day`}
                style={{ '--day': dayProgress } as CSSProperties}
            >
                <span />
            </div>
        </div>
    )
}

export function WeatherReading() {
    const [settings, setSettings] = useStorageValue('settings', DEFAULT_SETTINGS)
    const { cache, status, refresh } = useWeather()

    if (!settings.widgetsEnabled.includes('weather')) return null

    if (status === 'ready' && cache) {
        const { Icon, text } = describeCode(cache.current.conditionCode)
        const temp = (celsius: number) => toDisplayTemp(celsius, settings.tempUnit)
        const unitSymbol = settings.tempUnit === 'fahrenheit' ? '°F' : '°C'
        const detail = `${text} · feels ${temp(cache.current.feelsLikeC)}° · H:${temp(cache.current.maxC)}° L:${temp(cache.current.minC)}° · ${cache.location.label}`
        return (
            <button
                type="button"
                className="now-weather"
                data-sky={skyFor(cache.current.conditionCode)}
                title={`${detail} — click to switch to ${settings.tempUnit === 'celsius' ? 'Fahrenheit' : 'Celsius'}`}
                aria-label={detail}
                onClick={() => setSettings({ ...settings, tempUnit: settings.tempUnit === 'celsius' ? 'fahrenheit' : 'celsius' })}
            >
                <span className="now-weather-icon"><Icon size={28} weight="duotone" /></span>
                <span className="now-weather-temp">
                    {temp(cache.current.temperatureC)}
                    <span>{unitSymbol}</span>
                </span>
                <span className="now-weather-text">{text}</span>
            </button>
        )
    }

    if (status === 'loading' || status === 'checking-permission') {
        return (
            <span className="now-weather is-loading" aria-label="Loading weather">
                <span className="now-weather-icon" />
                <span className="now-weather-temp" />
                <span className="now-weather-text" />
            </span>
        )
    }

    // Declined or unavailable: one quiet prompt rather than something competing with the greeting.
    const failed = status === 'error'
    return (
        <button type="button" className="now-weather-prompt" onClick={refresh}>
            {failed ? <ArrowClockwiseIcon size={16} /> : <MapPinIcon size={16} />}
            {failed ? 'Retry weather' : 'Add weather'}
        </button>
    )
}
