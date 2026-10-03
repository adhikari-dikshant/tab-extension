import { useEffect, useState } from 'react'
import { QuestionIcon as CircleHelp } from '@phosphor-icons/react/dist/csr/Question'
import { CloudIcon as Cloud } from '@phosphor-icons/react/dist/csr/Cloud'
import { CloudRainIcon as CloudRain } from '@phosphor-icons/react/dist/csr/CloudRain'
import { CloudFogIcon as CloudFog } from '@phosphor-icons/react/dist/csr/CloudFog'
import { CloudLightningIcon as CloudLightning } from '@phosphor-icons/react/dist/csr/CloudLightning'
import { CloudSnowIcon as CloudSnow } from '@phosphor-icons/react/dist/csr/CloudSnow'
import { CloudSunIcon as CloudSun } from '@phosphor-icons/react/dist/csr/CloudSun'
import { SunIcon as Sun } from '@phosphor-icons/react/dist/csr/Sun'
import type { Icon as IconComponent } from '@phosphor-icons/react/lib'
import { type WeatherCache } from './storage'
import { useStorageValue } from './useStorageValue'

const CACHE_TTL_MS = 15 * 60 * 1000

const WEATHER_CODES: Record<number, { text: string; Icon: IconComponent }> = {
    0: { text: 'Clear sky', Icon: Sun },
    1: { text: 'Mostly clear', Icon: CloudSun },
    2: { text: 'Partly cloudy', Icon: CloudSun },
    3: { text: 'Overcast', Icon: Cloud },
    45: { text: 'Fog', Icon: CloudFog },
    48: { text: 'Fog', Icon: CloudFog },
    51: { text: 'Light drizzle', Icon: CloudRain },
    53: { text: 'Drizzle', Icon: CloudRain },
    55: { text: 'Heavy drizzle', Icon: CloudRain },
    61: { text: 'Light rain', Icon: CloudRain },
    63: { text: 'Rain', Icon: CloudRain },
    65: { text: 'Heavy rain', Icon: CloudRain },
    71: { text: 'Light snow', Icon: CloudSnow },
    73: { text: 'Snow', Icon: CloudSnow },
    75: { text: 'Heavy snow', Icon: CloudSnow },
    80: { text: 'Rain showers', Icon: CloudRain },
    95: { text: 'Thunderstorm', Icon: CloudLightning },
}

export function describeCode(code: number) {
    return WEATHER_CODES[code] ?? { text: 'Unknown', Icon: CircleHelp }
}

export function toDisplayTemp(celsius: number, unit: 'celsius' | 'fahrenheit'): number {
    return unit === 'fahrenheit' ? Math.round((celsius * 9) / 5 + 32) : Math.round(celsius)
}

/** Free, no-key reverse geocoding for a human-readable location label. Best-effort only —
 * falls back to a generic label if it fails, since it's cosmetic, not load-bearing. */
async function reverseGeocode(lat: number, lon: number): Promise<string> {
    try {
        const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
            { signal: AbortSignal.timeout(5000) },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        return data.city || data.locality || data.principalSubdivision || 'Current location'
    } catch {
        return 'Current location'
    }
}

export type WeatherStatus = 'checking-permission' | 'need-permission' | 'loading' | 'error' | 'ready'

/**
 * Fetching, caching and geolocation-permission handling for the weather reading, with no opinion
 * about how it is shown. Extracted from the old Weather card when the reading moved into the
 * welcome strip beside the clock — the data work outlived the card it was written in.
 */
export function useWeather() {
    const [cache, setCache, cacheLoading] = useStorageValue('weather:cache', null)
    const [status, setStatus] = useState<WeatherStatus>('checking-permission')

    const refresh = () => {
        setStatus('loading')
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords
                try {
                    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
                    const [res, label] = await Promise.all([
                        fetch(url, { signal: AbortSignal.timeout(10000) }),
                        reverseGeocode(latitude, longitude),
                    ])
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                    const data = await res.json()
                    const next: WeatherCache = {
                        fetchedAt: Date.now(),
                        location: { lat: latitude, lon: longitude, label },
                        current: {
                            temperatureC: data.current.temperature_2m,
                            feelsLikeC: data.current.apparent_temperature,
                            humidity: data.current.relative_humidity_2m,
                            conditionCode: data.current.weather_code,
                            maxC: data.daily.temperature_2m_max[0],
                            minC: data.daily.temperature_2m_min[0],
                        },
                    }
                    setCache(next)
                    setStatus('ready')
                } catch {
                    setStatus('error')
                }
            },
            (err) => {
                // PERMISSION_DENIED -> back to the opt-in prompt. POSITION_UNAVAILABLE / TIMEOUT
                // (including a hung OS-level location request) -> a real error, not a silent hang.
                setStatus(err.code === err.PERMISSION_DENIED ? 'need-permission' : 'error')
            },
            { timeout: 8000, maximumAge: 0 },
        )
    }

    useEffect(() => {
        if (cacheLoading) return
        let cancelled = false

        async function run() {
            if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
                setStatus('ready')
                return
            }
            if (!navigator.permissions?.query) {
                setStatus('need-permission')
                return
            }
            try {
                const result = await navigator.permissions.query({ name: 'geolocation' })
                if (cancelled) return
                setStatus(result.state === 'granted' ? 'loading' : 'need-permission')
                if (result.state === 'granted') refresh()
            } catch {
                if (!cancelled) setStatus('need-permission')
            }
        }

        void run()
        return () => { cancelled = true }
        // Runs once the cached value is known. `refresh` is stable enough in practice and is only
        // ever re-invoked explicitly, so re-running this on every render would just refetch.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cacheLoading])

    return { cache, status, refresh }
}
