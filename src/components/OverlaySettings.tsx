import { useEffect, useState } from 'react'
import { SettingRow } from './SettingRow'
import { Switch } from './Switch'
import { DEFAULT_SETTINGS } from '../lib/storage'
import { hasOverlayPermission, requestOverlayPermission } from '../lib/overlay'
import { useStorageValue } from '../lib/useStorageValue'
import { useToast } from '../lib/useToast'

/**
 * Controls for the page overlay. Site access is granted at install, but Chrome lets users withdraw
 * it, so the switch shows off whenever access is missing, re-requests it when flipped on, and reports
 * plainly when the request is declined, rather than appearing enabled while doing nothing.
 */
export default function OverlaySettings() {
    const [settings, setSettings] = useStorageValue('settings', DEFAULT_SETTINGS)
    const [granted, setGranted] = useState<boolean | null>(null)
    const toast = useToast()

    useEffect(() => {
        let cancelled = false
        void hasOverlayPermission().then((value) => { if (!cancelled) setGranted(value) })
        const check = () => { void hasOverlayPermission().then(setGranted) }
        chrome.permissions.onAdded.addListener(check)
        chrome.permissions.onRemoved.addListener(check)
        return () => {
            cancelled = true
            chrome.permissions.onAdded.removeListener(check)
            chrome.permissions.onRemoved.removeListener(check)
        }
    }, [])

    const toggle = async (next: boolean) => {
        if (!next) {
            setSettings({ ...settings, overlayEnabled: false })
            return
        }
        // Requested straight from the click so Chrome will show its prompt.
        const ok = granted || await requestOverlayPermission()
        if (!ok) {
            toast('Allow access to the sites you visit to show the bubble there.')
            return
        }
        setGranted(true)
        setSettings({ ...settings, overlayEnabled: true })
    }

    const unblock = (host: string) => {
        setSettings({ ...settings, overlayBlockedHosts: settings.overlayBlockedHosts.filter((item) => item !== host) })
    }

    return <>
        <SettingRow label="Bubble on other sites" description="A collapsed tasks/note bubble and focus timer while you browse">
            <Switch label="Bubble on other sites" checked={settings.overlayEnabled && granted !== false} onCheckedChange={(next) => void toggle(next)} />
        </SettingRow>
        <p className="productivity-muted py-2">
            On by default. It stays collapsed and muted until you point at it,
            sits under the site’s own dialogs, hides in fullscreen, and never appears on sign-in or checkout
            pages. Between sessions the focus timer is a small icon you can click to start one.
        </p>
        {settings.overlayEnabled && <SettingRow label="Bubble side" description="Move it off whatever the site keeps on that edge">
            <div className="flex rounded-full border border-black/10 p-0.5 text-xs dark:border-white/10">
                {(['left', 'right'] as const).map((side) => (
                    <button
                        key={side}
                        type="button"
                        onClick={() => setSettings({ ...settings, overlaySide: side })}
                        aria-pressed={settings.overlaySide === side}
                        className={`rounded-full px-2.5 py-1 capitalize ${settings.overlaySide === side ? 'bg-(--accent) text-white' : 'text-neutral-400'}`}
                    >
                        {side}
                    </button>
                ))}
            </div>
        </SettingRow>}
        {settings.overlayBlockedHosts.length > 0 && <div className="py-2">
            <p className="productivity-muted mb-1">Hidden on these sites:</p>
            <ul className="flex flex-wrap gap-1.5">
                {settings.overlayBlockedHosts.map((host) => (
                    <li key={host}>
                        <button
                            type="button"
                            onClick={() => unblock(host)}
                            aria-label={`Show the bubble on ${host} again`}
                            className="rounded-full border border-black/10 px-2.5 py-1 text-xs dark:border-white/10"
                        >
                            {host} ×
                        </button>
                    </li>
                ))}
            </ul>
        </div>}
    </>
}
