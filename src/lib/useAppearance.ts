import { useEffect } from 'react'
import { DEFAULT_SETTINGS } from './storage'
import { useStorageValue } from './useStorageValue'

/** Applies theme + accent + opacity to the document root: resolves theme "system" via
 * matchMedia (staying live if the OS preference changes), and sets the --accent and
 * --ui-opacity CSS variables. Call once at the page root. Wallpaper is applied separately, as
 * an inline style on the actual visible root element (see NewTab) rather than on
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
}
