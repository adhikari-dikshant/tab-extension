import { createNote, createShortcut, createTodo, type Note, type Shortcut, type Source, type Todo } from './storage'
import { safeWebUrl } from './productivity'

/** What a capture command knows about the page it fired on. */
export interface PageContext {
    url: string
    title?: string
    /** Text the user had selected, when the injection to read it succeeded. */
    selection?: string
}

export const CAPTURE_COMMANDS = ['capture-task', 'capture-note', 'capture-link'] as const
export type CaptureCommand = (typeof CAPTURE_COMMANDS)[number]

/** Below this, a leading segment is more likely a fragment than a title, so the full title is kept
 * rather than cutting a page down to something like "Re" or "404". */
const MIN_TITLE_HEAD = 4

/** Trims a page title down to something that reads as a task or a label. Sites pad titles with
 * their own name ("Some Article — Example News"), which is noise once the source URL is attached. */
export function cleanTitle(title: string | undefined, url: string): string {
    const trimmed = (title ?? '').replace(/\s+/g, ' ').trim()
    if (!trimmed) {
        try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
    }
    const [head] = trimmed.split(/\s+[—–|·]\s+/)
    return (head.length >= MIN_TITLE_HEAD ? head : trimmed).slice(0, 200)
}

export function sourceFor(page: PageContext, now = Date.now()): Source {
    return { url: page.url, capturedAt: now, ...(page.title ? { title: page.title.slice(0, 300) } : {}) }
}

/** A page can only be captured if it is a real web page. Browser-internal pages (`chrome://`,
 * `about:`) and local files have nothing worth storing and would produce dead links. */
export function canCapture(page: PageContext | null | undefined): page is PageContext {
    return !!page && safeWebUrl(page.url)
}

export function taskFromPage(page: PageContext, now = Date.now()): Todo {
    return createTodo(cleanTitle(page.title, page.url), { source: sourceFor(page, now), createdAt: now, updatedAt: now })
}

/** A selection becomes the note's body, which is the point of capturing one — the page title alone
 * is already covered by a task or a link. */
export function noteFromPage(page: PageContext, now = Date.now()): Note {
    const selection = (page.selection ?? '').trim()
    return createNote({
        title: cleanTitle(page.title, page.url),
        body: selection.slice(0, 100_000),
        source: sourceFor(page, now),
        createdAt: now,
        updatedAt: now,
    })
}

export function linkFromPage(page: PageContext, now = Date.now()): Shortcut {
    return createShortcut(cleanTitle(page.title, page.url), page.url, { source: sourceFor(page, now), createdAt: now, updatedAt: now })
}

/** Message a capture reports back, so the toast and the notification say the same thing. */
export function captureMessage(command: CaptureCommand, label: string, hadSelection: boolean): string {
    if (command === 'capture-task') return `Saved as a task: ${label}`
    if (command === 'capture-link') return `Saved as a shortcut: ${label}`
    return hadSelection ? `Saved the selection as a note: ${label}` : `Saved as a note: ${label}`
}
