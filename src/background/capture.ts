import {
    CAPTURE_COMMANDS, canCapture, captureMessage, linkFromPage, noteFromPage, taskFromPage,
    type CaptureCommand, type PageContext,
} from '../lib/capture'
import { changeStored } from '../lib/productivity'
import type { Settings } from '../lib/storage'

const OPEN_SEARCH = 'open-search'
/** Read by the dashboard on load to focus the command bar; see CommandBar's pending-search effect. */
const SEARCH_REQUEST_KEY = 'capture:searchRequest'

/**
 * Reads the active tab. `activeTab` is granted by the command gesture itself, so url and title are
 * readable without the extension holding a standing `tabs` permission.
 */
async function activePage(): Promise<PageContext | null> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url || tab.incognito) return null
    const page: PageContext = { url: tab.url, ...(tab.title ? { title: tab.title } : {}) }
    if (tab.id === undefined) return page

    // The selection is a bonus, not a requirement: injection fails on pages the browser protects
    // (the web store, PDF viewers, a tab that navigated away mid-command). Capture proceeds without
    // it rather than failing the whole command.
    try {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection()?.toString() ?? '',
        })
        const selection = typeof result?.result === 'string' ? result.result.trim() : ''
        if (selection) page.selection = selection
    } catch {
        // no selection available — fall through
    }
    return page
}

async function announce(message: string) {
    // The dashboard shows this as a toast if a new tab is open; otherwise a desktop notification is
    // the only way the user learns the capture landed. Both paths are best-effort.
    try {
        await chrome.runtime.sendMessage({ type: 'capture:done', message })
    } catch {
        // no dashboard listening, which is the normal case when capturing from another page
    }
    const { settings } = await chrome.storage.local.get('settings')
    if (!(settings as Settings | undefined)?.desktopReminders) return
    if (!await chrome.permissions.contains({ permissions: ['notifications'] })) return
    await chrome.notifications.create(`capture-${Date.now()}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Daily Workspace',
        message,
    })
}

async function runCapture(command: CaptureCommand) {
    const page = await activePage()
    if (!canCapture(page)) {
        await announce('That page can’t be captured — open a regular web page and try again.')
        return
    }

    if (command === 'capture-task') {
        const todo = taskFromPage(page)
        await changeStored('todos', [], (items) => [...items, todo])
        await announce(captureMessage(command, todo.text, false))
        return
    }
    if (command === 'capture-note') {
        const note = noteFromPage(page)
        await changeStored('notes', [], (items) => [...items, note])
        await announce(captureMessage(command, note.title, !!page.selection))
        return
    }
    const link = linkFromPage(page)
    // Capturing a page already saved would quietly duplicate it; the dedupe key used on import
    // applies here too, one record at a time.
    let duplicate = false
    await changeStored('shortcuts', [], (items) => {
        duplicate = items.some((item) => item.url === link.url)
        return duplicate ? items : [...items, link]
    })
    await announce(duplicate ? `Already saved: ${link.label}` : captureMessage(command, link.label, false))
}

/** Opens the dashboard with the command bar focused. A new tab is created rather than reusing one,
 * so the page the user is on is never navigated away from under them. */
async function openSearch() {
    await chrome.storage.local.set({ [SEARCH_REQUEST_KEY]: Date.now() })
    await chrome.tabs.create({ url: chrome.runtime.getURL('index.html') })
}

chrome.commands.onCommand.addListener((command) => {
    if ((CAPTURE_COMMANDS as readonly string[]).includes(command)) {
        void runCapture(command as CaptureCommand)
    } else if (command === OPEN_SEARCH) {
        void openSearch()
    }
})
