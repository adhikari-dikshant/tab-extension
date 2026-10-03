import type { Note, Shortcut, Todo } from './storage'

export interface PaletteResult {
    kind: 'tab' | 'shortcut' | 'bookmark' | 'aiTool' | 'todo' | 'note'
    key: string
    label: string
    /** Where selecting the result navigates. Empty for a task or note, which live on the dashboard
     * and are opened in place via `recordId` instead. */
    url: string
    favicon?: string
    tabId?: number
    windowId?: number
    /** Id of the matched task or note, for revealing it on the dashboard. */
    recordId?: string
    /** Secondary line: a task's due date, a note's body excerpt, or a captured page's host. */
    detail?: string
}

const MAX_PER_KIND = 3

function matches(haystack: string, query: string): boolean {
    return haystack.toLowerCase().includes(query)
}

/** Searches your own data (open tabs, shortcuts, AI tools, bookmarks) for a query — the
 * "unified command palette" sources. Each source is skipped silently if its permission isn't
 * granted, rather than forcing a permission prompt just from typing. */
export async function searchLocalSources(
    query: string,
    opts: {
        tabsGranted: boolean
        bookmarksGranted: boolean
        shortcuts: Shortcut[]
        aiTools: Shortcut[]
        todos?: Todo[]
        notes?: Note[]
    },
): Promise<PaletteResult[]> {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const results: PaletteResult[] = []

    // Your own tasks and notes come first: they are the things only this extension can find, and
    // nothing else in the results list can stand in for them.
    const openFirst = [...(opts.todos ?? [])].sort((a, b) => Number(a.done) - Number(b.done) || b.updatedAt - a.updatedAt)
    for (const todo of openFirst) {
        if (results.filter((r) => r.kind === 'todo').length >= MAX_PER_KIND) break
        if (!matches(todo.text, q)) continue
        const detail = [todo.done ? 'Completed' : null, todo.dueDate ? `Due ${todo.dueDate}` : null]
            .filter(Boolean).join(' · ')
        results.push({ kind: 'todo', key: `todo-${todo.id}`, label: todo.text, url: '', recordId: todo.id, ...(detail ? { detail } : {}) })
    }

    const recentNotes = [...(opts.notes ?? [])].sort((a, b) => b.updatedAt - a.updatedAt)
    for (const note of recentNotes) {
        if (results.filter((r) => r.kind === 'note').length >= MAX_PER_KIND) break
        if (!matches(`${note.title} ${note.body}`, q)) continue
        const excerpt = note.body.replace(/\s+/g, ' ').trim().slice(0, 80)
        results.push({
            kind: 'note', key: `note-${note.id}`, label: note.title || 'Untitled note', url: '', recordId: note.id,
            ...(excerpt ? { detail: excerpt } : {}),
        })
    }

    for (const s of opts.shortcuts) {
        if (results.filter((r) => r.kind === 'shortcut').length >= MAX_PER_KIND) break
        if (matches(s.label, q)) {
            results.push({ kind: 'shortcut', key: `shortcut-${s.id}`, label: s.label, url: s.url, favicon: s.icon })
        }
    }

    for (const t of opts.aiTools) {
        if (results.filter((r) => r.kind === 'aiTool').length >= MAX_PER_KIND) break
        if (matches(t.label, q)) {
            results.push({ kind: 'aiTool', key: `aitool-${t.id}`, label: t.label, url: t.url, favicon: t.icon })
        }
    }

    if (opts.tabsGranted) {
        try {
            const tabs = await chrome.tabs.query({})
            for (const tab of tabs) {
                if (results.filter((r) => r.kind === 'tab').length >= MAX_PER_KIND) break
                if (tab.id === undefined || tab.windowId === undefined) continue
                if (matches(`${tab.title ?? ''} ${tab.url ?? ''}`, q)) {
                    results.push({
                        kind: 'tab',
                        key: `tab-${tab.id}`,
                        label: tab.title || tab.url || 'Untitled tab',
                        url: tab.url ?? '',
                        favicon: tab.favIconUrl,
                        tabId: tab.id,
                        windowId: tab.windowId,
                    })
                }
            }
        } catch {
            // permission may have been revoked between the check and this call — skip silently
        }
    }

    if (opts.bookmarksGranted) {
        try {
            const matched = await chrome.bookmarks.search(query)
            for (const b of matched) {
                if (results.filter((r) => r.kind === 'bookmark').length >= MAX_PER_KIND) break
                if (b.url) results.push({ kind: 'bookmark', key: `bookmark-${b.id}`, label: b.title || b.url, url: b.url })
            }
        } catch {
            // same as above
        }
    }

    return results
}
