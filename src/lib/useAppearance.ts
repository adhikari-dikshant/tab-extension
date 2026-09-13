import { useEffect } from 'react'
import { DEFAULT_SETTINGS } from './storage'
import { useStorageValue } from './useStorageValue'

/** Applies theme + accent + opacity to the document root: resolves theme "system" via
 * matchMedia (staying live if the OS preference changes), sets the --accent and --ui-opacity
 * CSS variables, and flags data-wallpaper so cards/command-bar know to switch from a solid
 * tonal fill to frosted glass. Call once at the page root. The wallpaper image itself is applied
 * separately as an inline style on the actual visible root element (see NewTab) rather than on
 * document.body, which sits behind that element and would never show through. */
export function useAppearance() {
    const [settings] = useStorageValue('settings', DEFAULT_SETTINGS)

    useEffect(() => {
        const mql = window.matchMedia('(prefers-color-scheme: dark)')

        const apply = () => {
            const effective = settings.theme === 'system' ? (mql.matches ? 'dark' : 'light') : settings.theme
            document.documentElement.dataset.theme = effective
        }

        apply()
        if (settings.theme !== 'system') return
        mql.addEventListener('change', apply)
        return () => mql.removeEventListener('change', apply)
    }, [settings.theme])

    useEffect(() => {
        document.documentElement.style.setProperty('--accent', settings.accentColor)
    }, [settings.accentColor])

    useEffect(() => {
        document.documentElement.style.setProperty('--ui-opacity', String(settings.opacity / 100))
    }, [settings.opacity])

    useEffect(() => {
        const active = settings.wallpaper.type !== 'none' && !!settings.wallpaper.value
        document.documentElement.dataset.wallpaper = String(active)
    }, [settings.wallpaper])
}
