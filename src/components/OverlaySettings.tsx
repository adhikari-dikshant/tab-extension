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

    // Nothing to reset when neither has been moved, so the button says so rather than being a
    // no-op the user has to try to find out.
    const atDefaultPosition =
        settings.overlayHandle.side === DEFAULT_SETTINGS.overlayHandle.side
        && settings.overlayHandle.offsetY === DEFAULT_SETTINGS.overlayHandle.offsetY
        && settings.overlayTimer.x === DEFAULT_SETTINGS.overlayTimer.x
        && settings.overlayTimer.y === DEFAULT_SETTINGS.overlayTimer.y

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
        {settings.overlayEnabled && granted && <>
            <SettingRow label="Tasks & note bubble" description="A collapsed handle on the edge of the page">
                <Switch label="Tasks and note bubble" checked={settings.overlayTasksEnabled} onCheckedChange={(overlayTasksEnabled) => setSettings({ ...settings, overlayTasksEnabled })} />
            </SettingRow>
            <SettingRow label="Focus timer" description="Shown only while a session is running">
                <Switch label="Focus timer on other sites" checked={settings.overlayTimerEnabled} onCheckedChange={(overlayTimerEnabled) => setSettings({ ...settings, overlayTimerEnabled })} />
            </SettingRow>
            <SettingRow label="Position" description="Drag either one on any page. The bubble snaps to the nearest side.">
                <button
                    type="button"
                    onClick={() => setSettings({ ...settings, overlayHandle: DEFAULT_SETTINGS.overlayHandle, overlayTimer: DEFAULT_SETTINGS.overlayTimer })}
                    disabled={atDefaultPosition}
                    className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-white/10"
                >
                    Reset
                </button>
            </SettingRow>
        </>}
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
