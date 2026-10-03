/**
 * Content-script entry point for the page overlay. Registered at runtime by
 * `syncOverlayRegistration` only after the user turns the feature on and grants the host permission,
 * so this file never runs on a page unless both are true.
 *
 * Everything renders inside a shadow root: the host page's CSS cannot restyle the overlay, and the
 * overlay's own styles cannot leak out and break the page. That isolation is the whole reason this
 * mounts into an injected element rather than into document.body directly.
 */
import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { IconContext } from '@phosphor-icons/react/dist/lib/context'
import OverlayPanel from './OverlayPanel'
import overlayCss from './overlay.css?inline'
import { DEFAULT_SETTINGS } from '../lib/storage'
import { shouldShowOverlay } from '../lib/overlay'

const CONTAINER_ID = 'daily-workspace-overlay-root'

async function mount() {
    // Re-injection guard: registered scripts run once per page, but an SPA navigation or a second
    // registration must not stack a second overlay on top of the first.
    if (document.getElementById(CONTAINER_ID)) return

    const { settings } = await chrome.storage.local.get('settings')
    const resolved = { ...DEFAULT_SETTINGS, ...(settings as object | undefined) }
    if (!resolved.overlayEnabled) return
    if (!shouldShowOverlay(window.location.hostname, resolved.overlayBlockedHosts)) return

    const container = document.createElement('div')
    container.id = CONTAINER_ID
    // The container is zero-size and non-interactive; the shadow root's fixed children do the work,
    // so nothing here can shift the page's layout or swallow its clicks.
    container.style.cssText = 'all: initial; position: static; width: 0; height: 0;'
    const shadow = container.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = overlayCss
    shadow.append(style)

    const mountPoint = document.createElement('div')
    shadow.append(mountPoint)
    document.body.append(container)

    createRoot(mountPoint).render(
        <StrictMode>
            <IconContext.Provider value={{ weight: 'regular', 'aria-hidden': true }}>
                <OverlayPanel />
            </IconContext.Provider>
        </StrictMode>,
    )
}

void mount()
