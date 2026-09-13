import { useState } from 'react'
import { domainColor } from '../lib/screentime'
import { DEFAULT_SETTINGS, faviconFor } from '../lib/storage'
import { useStorageValue } from '../lib/useStorageValue'

/**
 * Fallback chain: custom uploaded icon (if any) -> cached chrome favicon -> Google favicon
 * service -> a generated letter avatar. Mirrors the chain MYNT uses so a broken/missing
 * favicon never shows a blank box.
 */
// Chrome's chrome-extension://<id>/_favicon/ endpoint (used by the "cached" stage below) has no
// Firefox equivalent, so start Firefox straight at the "google" stage instead of burning a
// request that's guaranteed to fail there.
const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent)

export function ShortcutIcon({ url, label, icon, className }: { url: string; label: string; icon?: string; className: string }) {
    const [settings] = useStorageValue('settings', DEFAULT_SETTINGS)
    const [stage, setStage] = useState<'custom' | 'cached' | 'google' | 'letter'>(
        icon ? 'custom' : isFirefox ? 'google' : 'cached',
    )

    const [loaded, setLoaded] = useState(false)
    const initial = (label.trim()[0] || '?').toUpperCase()

    const onError = () => {
        setLoaded(false)
        if (stage === 'custom' || stage === 'cached') setStage((prev) => (prev === 'custom' ? 'cached' : 'google'))
        else if (stage === 'google') setStage('letter')
    }

    if (stage === 'letter') {
        return (
            <span
                className={`flex shrink-0 items-center justify-center rounded-xl font-medium text-white ${className}`}
                style={{ backgroundColor: domainColor(label || url) }}
            >
                {initial}
            </span>
        )
    }

    const src =
        stage === 'custom'
            ? icon!
            : stage === 'cached'
              ? `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=64`
              : faviconFor(url)

    // Favicons are baked-in light-background bitmaps by default; "adaptive" softens that
    // clash in dark mode by inverting+correcting hue rather than leaving a glaring white tile.
    const adaptiveClass =
        settings.adaptiveIcons && stage !== 'custom' ? 'dark:invert dark:hue-rotate-180 dark:brightness-90' : ''

    return (
        <span
            className={`relative flex shrink-0 items-center justify-center rounded-md text-xs font-medium text-white ${className}`}
            style={loaded ? undefined : { backgroundColor: domainColor(label || url) }}
            aria-hidden="true"
        >
            {!loaded && initial}
            <img
                src={src}
                alt=""
                onError={onError}
                onLoad={() => setLoaded(true)}
                className={`absolute inset-0 h-full w-full object-contain ${adaptiveClass} ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
        </span>
    )
}
