/**
 * The page overlay is the only part of Daily Workspace that runs on sites you visit. Its `<all_urls>`
 * access is granted at install so the bubble works out of the box, but the script is still
 * registered at runtime rather than declared in the manifest, so the settings switch can take it off
 * every page. Chrome also lets users withhold site access after install, so the grant is checked
 * rather than assumed.
 */
export const OVERLAY_SCRIPT_ID = 'daily-workspace-overlay'
/** Built by vite.overlay.config.ts to this fixed path — the main build hashes its filenames, and a
 * registration needs a path that survives rebuilds. */
export const OVERLAY_SCRIPT_FILE = 'content/overlay.js'
export const OVERLAY_HOST_PERMISSION: chrome.permissions.Permissions = { origins: ['<all_urls>'] }
const OVERLAY_MATCHES = ['http://*/*', 'https://*/*']

export async function hasOverlayPermission(): Promise<boolean> {
    try {
        return await chrome.permissions.contains(OVERLAY_HOST_PERMISSION)
    } catch {
        return false
    }
}

/** Only needed if the user has restricted site access in Chrome. Must be called straight from a
 * click: Chrome only shows the host-permission prompt for a gesture. */
export async function requestOverlayPermission(): Promise<boolean> {
    try {
        return await chrome.permissions.request(OVERLAY_HOST_PERMISSION)
    } catch {
        return false
    }
}

/**
 * Brings the registered content script in line with whether the overlay should be running. Safe to
 * call repeatedly — it reconciles rather than assuming, because the registration survives service
 * worker restarts while the setting can change at any time from any tab.
 */
export async function syncOverlayRegistration(enabled: boolean): Promise<void> {
    const granted = await hasOverlayPermission()
    const shouldRun = enabled && granted

    let registered = false
    try {
        const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [OVERLAY_SCRIPT_ID] })
        registered = existing.length > 0
    } catch {
        // Nothing registered yet, which getRegisteredContentScripts can report as a throw.
    }

    if (!shouldRun) {
        if (registered) await chrome.scripting.unregisterContentScripts({ ids: [OVERLAY_SCRIPT_ID] })
        return
    }
    if (registered) return

    await chrome.scripting.registerContentScripts([{
        id: OVERLAY_SCRIPT_ID,
        js: [OVERLAY_SCRIPT_FILE],
        matches: OVERLAY_MATCHES,
        runAt: 'document_idle',
        allFrames: false,
        persistAcrossSessions: true,
    }])
    await injectIntoOpenTabs()
}

/** A registered script only runs on pages loaded after registration, so tabs that were already open
 * when the bubble was switched on would stay bare until reloaded. The script's own re-injection
 * guard makes a second run on the same page a no-op. */
async function injectIntoOpenTabs(): Promise<void> {
    const tabs = await chrome.tabs.query({ url: OVERLAY_MATCHES })
    await Promise.allSettled(tabs.map((tab) => tab.id === undefined ? undefined : chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [OVERLAY_SCRIPT_FILE],
    })))
}

/** Hosts the overlay never shows on, regardless of settings: the dashboard already shows all of
 * this inline, and a bubble over a payment or auth form is exactly where it is least wanted. */
const NEVER_OVERLAY = [
    /(^|\.)accounts\.google\.com$/,
    /(^|\.)login\.microsoftonline\.com$/,
    /(^|\.)checkout\.stripe\.com$/,
    /(^|\.)paypal\.com$/,
]

export function shouldShowOverlay(hostname: string, blockedHosts: string[]): boolean {
    const host = hostname.replace(/^www\./, '').toLowerCase()
    if (NEVER_OVERLAY.some((pattern) => pattern.test(host))) return false
    return !blockedHosts.some((blocked) => {
        const needle = blocked.replace(/^www\./, '').toLowerCase()
        return host === needle || host.endsWith(`.${needle}`)
    })
}
