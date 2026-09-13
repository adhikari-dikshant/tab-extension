import type { FocusState, StorageSchema, Todo } from './storage'

/** Serialize read-modify-write operations across extension tabs and the service worker. */
export function changeStored<K extends keyof StorageSchema>(key: K, fallback: StorageSchema[K], change: (value: StorageSchema[K]) => StorageSchema[K]) {
    return navigator.locks.request(`dashboard:${key}`, async () => {
        const data = await chrome.storage.local.get(key)
        const current = (data[key] as StorageSchema[K] | undefined) ?? fallback
        const next = change(current)
        if (JSON.stringify(current) !== JSON.stringify(next)) await chrome.storage.local.set({ [key]: next })
        return next
    })
}

export function localDate(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function nextOccurrence(dueDate: string | undefined, repeat: 'daily' | 'weekly', now = new Date()): string {
    const date = new Date(`${dueDate || localDate(now)}T12:00:00`)
    if (Number.isNaN(date.getTime())) return nextOccurrence(undefined, repeat, now)
    const step = repeat === 'weekly' ? 7 : 1
    do { date.setDate(date.getDate() + step) } while (localDate(date) <= localDate(now))
    return localDate(date)
}

export function completeTodo(todo: Todo, now = new Date()): Todo {
    if (todo.done) return { ...todo, done: false }
    if (todo.repeat && todo.repeat !== 'none') {
        return { ...todo, dueDate: nextOccurrence(todo.dueDate, todo.repeat, now), done: false, completedCount: (todo.completedCount || 0) + 1, lastCompletedAt: now.getTime() }
    }
    return { ...todo, done: true, lastCompletedAt: now.getTime() }
}

export const EMPTY_FOCUS: FocusState = { session: null, history: [] }
export const FOCUS_ALARM = 'focus-session-end'

export async function settleFocus(now = Date.now()) {
    let completed = false
    const state = await changeStored('focus', EMPTY_FOCUS, (value) => {
        const session = value.session
        if (!session || session.status !== 'running' || !session.endsAt || session.endsAt > now) return value
        completed = true
        return {
            session: { ...session, status: 'finished', remainingMs: 0 },
            history: session.mode === 'focus' && !value.history.some((entry) => entry.id === session.id)
                ? [{ id: session.id, taskId: session.taskId, label: session.label, minutes: session.durationMs / 60000, completedAt: session.endsAt }, ...value.history].slice(0, 365)
                : value.history,
        }
    })
    return { state, completed }
}

export async function startFocus(minutes: number, task?: Pick<Todo, 'id' | 'text'>, mode: 'focus' | 'break' = 'focus') {
    const durationMs = Math.max(1, Math.min(180, minutes)) * 60000
    // A running or paused session must be explicitly stopped before another can start.
    return changeStored('focus', EMPTY_FOCUS, (value) => value.session && value.session.status !== 'finished' ? value : {
        ...value,
        session: { id: crypto.randomUUID(), taskId: task?.id, label: mode === 'break' ? 'Break' : task?.text || 'Focus session', mode, durationMs, remainingMs: durationMs, endsAt: Date.now() + durationMs, status: 'running' },
    })
}

export function safeWebUrl(url: string) {
    try { return ['http:', 'https:'].includes(new URL(url).protocol) } catch { return false }
}
