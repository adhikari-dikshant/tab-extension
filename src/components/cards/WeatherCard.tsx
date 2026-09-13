import { useEffect, useState, type ReactNode } from 'react'
import { QuestionIcon as CircleHelp } from '@phosphor-icons/react/dist/csr/Question'
import { CloudIcon as Cloud } from '@phosphor-icons/react/dist/csr/Cloud'
import { CloudRainIcon as CloudDrizzle } from '@phosphor-icons/react/dist/csr/CloudRain'
import { CloudFogIcon as CloudFog } from '@phosphor-icons/react/dist/csr/CloudFog'
import { CloudLightningIcon as CloudLightning } from '@phosphor-icons/react/dist/csr/CloudLightning'
import { CloudRainIcon as CloudRain } from '@phosphor-icons/react/dist/csr/CloudRain'
import { CloudSnowIcon as CloudSnow } from '@phosphor-icons/react/dist/csr/CloudSnow'
import { CloudSunIcon as CloudSun } from '@phosphor-icons/react/dist/csr/CloudSun'
import { DropIcon as Droplet } from '@phosphor-icons/react/dist/csr/Drop'
import { MapPinIcon as MapPin } from '@phosphor-icons/react/dist/csr/MapPin'
import { SunIcon as Sun } from '@phosphor-icons/react/dist/csr/Sun'
import { ThermometerIcon as Thermometer } from '@phosphor-icons/react/dist/csr/Thermometer'
import type { Icon as IconComponent } from '@phosphor-icons/react/lib'
import { BentoCard } from '../BentoGrid'
import { CardEmpty, CardError, CardSkeleton } from '../CardState'
import { DEFAULT_SETTINGS, type WeatherCache } from '../../lib/storage'
import { useStorageValue } from '../../lib/useStorageValue'

const CACHE_TTL_MS = 15 * 60 * 1000

const WEATHER_CODES: Record<number, { text: string; Icon: IconComponent }> = {
    0: { text: 'Clear sky', Icon: Sun },
    1: { text: 'Mostly clear', Icon: CloudSun },
    2: { text: 'Partly cloudy', Icon: CloudSun },
    3: { text: 'Overcast', Icon: Cloud },
    45: { text: 'Fog', Icon: CloudFog },
    48: { text: 'Fog', Icon: CloudFog },
    51: { text: 'Light drizzle', Icon: CloudDrizzle },
    53: { text: 'Drizzle', Icon: CloudDrizzle },
    55: { text: 'Heavy drizzle', Icon: CloudRain },
    61: { text: 'Light rain', Icon: CloudDrizzle },
    63: { text: 'Rain', Icon: CloudRain },
    65: { text: 'Heavy rain', Icon: CloudRain },
    71: { text: 'Light snow', Icon: CloudSnow },
    73: { text: 'Snow', Icon: CloudSnow },
    75: { text: 'Heavy snow', Icon: CloudSnow },
    80: { text: 'Rain showers', Icon: CloudDrizzle },
    95: { text: 'Thunderstorm', Icon: CloudLightning },
}

function describeCode(code: number) {
    return WEATHER_CODES[code] ?? { text: 'Unknown', Icon: CircleHelp }
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

function Pill({ icon: Icon, fillPercent, children }: { icon: IconComponent; fillPercent?: number; children: ReactNode }) {
    return (
        <span className="relative flex items-center gap-1.5 overflow-hidden rounded-full bg-black/5 px-3 py-1 text-xs text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
            {fillPercent !== undefined && (
                <span
                    className="absolute inset-y-0 left-0 bg-blue-400/25 dark:bg-blue-400/20"
                    style={{ width: `${Math.min(Math.max(fillPercent, 0), 100)}%` }}
                />
            )}
            <Icon className="relative h-3.5 w-3.5 shrink-0" />
            <span className="relative">{children}</span>
        </span>
    )
}

type Status = 'checking-permission' | 'need-permission' | 'loading' | 'error' | 'ready'

export default function WeatherCard() {
    const [settings, setSettings] = useStorageValue('settings', DEFAULT_SETTINGS)
    const [cache, setCache, cacheLoading] = useStorageValue('weather:cache', null)
    const [status, setStatus] = useState<Status>('checking-permission')

    const fetchWeather = () => {
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
                if (result.state === 'granted') {
                    fetchWeather()
                } else {
                    setStatus('need-permission')
                }
            } catch {
                if (!cancelled) setStatus('need-permission')
            }
        }

        run()
        return () => {
            cancelled = true
        }
        // Wait for stored weather before deciding the initial status; fetchWeather is only
        // ever invoked afterwards via the explicit "Enable location" button.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cacheLoading])

    const displayTemp = (celsius: number) =>
        settings.tempUnit === 'fahrenheit' ? Math.round((celsius * 9) / 5 + 32) : Math.round(celsius)
    const unitSymbol = settings.tempUnit === 'fahrenheit' ? '°F' : '°C'

    return (
        <BentoCard title="Weather" className="weather-card" action={<span className="card-meta">LOCAL</span>}>
            {status === 'checking-permission' || status === 'loading' ? (
                <CardSkeleton />
            ) : status === 'need-permission' ? (
                <CardEmpty>
                    <span className="weather-sun" aria-hidden="true">☀</span><strong>A peek outside.</strong><p className="mb-2">Your local forecast, right here.</p>
                    <button
                        type="button"
                        onClick={fetchWeather}
                        className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-black"
                    >
                        Enable location
                    </button>
                </CardEmpty>
            ) : status === 'error' ? (
                <CardError>
                    <p className="mb-2">Couldn't load weather.</p>
                    <button
                        type="button"
                        onClick={fetchWeather}
                        className="rounded-full bg-red-600/10 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400"
                    >
                        Retry
                    </button>
                </CardError>
            ) : cache ? (
                (() => {
                    const { Icon, text } = describeCode(cache.current.conditionCode)
                    return (
                        <div className="weather-content space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-xs text-neutral-400">{text}</p>
                                    <p className="weather-temperature tabular-nums">
                                        {displayTemp(cache.current.temperatureC)}°
                                    </p>
                                    <p className="text-xs text-neutral-400">
                                        H:{displayTemp(cache.current.maxC)}° L:{displayTemp(cache.current.minC)}°
                                    </p>
                                </div>
                                <Icon className="h-11 w-11 shrink-0 text-neutral-400 dark:text-neutral-500" />
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                <Pill icon={Droplet} fillPercent={cache.current.humidity}>
                                    Humidity {cache.current.humidity}%
                                </Pill>
                                <Pill icon={Thermometer}>Feels {displayTemp(cache.current.feelsLikeC)}°</Pill>
                                <Pill icon={MapPin}>{cache.location.label}</Pill>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setSettings({
                                            ...settings,
                                            tempUnit: settings.tempUnit === 'celsius' ? 'fahrenheit' : 'celsius',
                                        })
                                    }
                                    className="rounded-full bg-black/5 px-3 py-1 text-xs text-neutral-600 dark:bg-white/10 dark:text-neutral-300"
                                >
                                    {unitSymbol}
                                </button>
                            </div>
                        </div>
                    )
                })()
            ) : (
                <CardSkeleton />
            )}
        </BentoCard>
    )
}
