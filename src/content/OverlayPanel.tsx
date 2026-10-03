import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { ChecksIcon } from '@phosphor-icons/react/dist/csr/Checks'
import { NotePencilIcon } from '@phosphor-icons/react/dist/csr/NotePencil'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { EyeSlashIcon } from '@phosphor-icons/react/dist/csr/EyeSlash'
import { PauseIcon } from '@phosphor-icons/react/dist/csr/Pause'
import { PlayIcon } from '@phosphor-icons/react/dist/csr/Play'
import { TimerIcon } from '@phosphor-icons/react/dist/csr/Timer'
import { DEFAULT_SETTINGS, createNote, createTodo, touch, type Note } from '../lib/storage'
import { useStorageValue } from '../lib/useStorageValue'
import { changeStored, completeTodo, EMPTY_FOCUS, startFocus } from '../lib/productivity'
import { noteFromPage, taskFromPage } from '../lib/capture'

/** Resolves the theme the overlay should use. It cannot read the dashboard's document, so "system"
 * is answered by this page's own media query. */
function useTheme() {
    const [settings] = useStorageValue('settings', DEFAULT_SETTINGS)
    const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
    useEffect(() => {
        const mql = window.matchMedia('(prefers-color-scheme: dark)')
        const listener = () => setSystemDark(mql.matches)
        mql.addEventListener('change', listener)
        return () => mql.removeEventListener('change', listener)
    }, [])
    return settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme
}

function pageContext() {
    return { url: window.location.href, title: document.title }
}

function TodoPane() {
    const [todos] = useStorageValue('todos', [])
    const [text, setText] = useState('')
    const openCount = todos.filter((todo) => !todo.done).length
    const shown = [...todos]
        .sort((a, b) => Number(a.done) - Number(b.done) || Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
        .slice(0, 25)

    const add = async (event: FormEvent) => {
        event.preventDefault()
        if (!text.trim()) return
        const todo = createTodo(text.trim())
        setText('')
        await changeStored('todos', [], (items) => [...items, todo])
    }

    return <>
        <form className="add-row" onSubmit={(event) => void add(event)}>
            <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Add a task…" aria-label="Add a task" />
        </form>
        {shown.length === 0 ? <p className="empty">Nothing on the list.</p> : <ul className="list">
            {shown.map((todo) => <li key={todo.id} data-done={todo.done}>
                <input
                    type="checkbox"
                    checked={todo.done}
                    aria-label={`Complete ${todo.text}`}
                    onChange={() => void changeStored('todos', [], (items) => items.map((item) => item.id === todo.id ? completeTodo(item) : item))}
                />
                <span>{todo.text}</span>
            </li>)}
        </ul>}
        <p className="status">{openCount} open · synced with your dashboard</p>
    </>
}

function NotesPane() {
    const [notes] = useStorageValue('notes', [])
    // Writes to the pinned note, or the most recent one — the same note the dashboard opens by
    // default, so the overlay edits what the user thinks of as "my note".
    const target: Note | undefined = notes.find((note) => note.pinned)
        ?? [...notes].sort((a, b) => b.updatedAt - a.updatedAt)[0]
    const [draft, setDraft] = useState(target?.body ?? '')
    const [status, setStatus] = useState('')
    const noteId = useRef(target?.id)
    const version = useRef(0)

    // Re-sync only when the target note changes identity, so an incoming storage event mid-sentence
    // cannot overwrite what is being typed.
    useEffect(() => {
        if (target?.id === noteId.current) return
        noteId.current = target?.id
        setDraft(target?.body ?? '')
    }, [target?.id, target?.body])

    const write = (body: string) => {
        setDraft(body)
        const revision = ++version.current
        setStatus('Saving…')
        const done = () => { if (version.current === revision) setStatus('Saved') }
        const fail = () => { if (version.current === revision) setStatus('Could not save') }
        if (!target) {
            const note = createNote({ body })
            noteId.current = note.id
            void changeStored('notes', [], (items) => [...items, note]).then(done, fail)
            return
        }
        void changeStored('notes', [], (items) => items.map((item) => item.id === target.id ? touch({ ...item, body }) : item)).then(done, fail)
    }

    return <>
        <textarea
            className="note-input"
            value={draft}
            onChange={(event) => write(event.target.value)}
            placeholder="Jot something down…"
            aria-label={target ? `Note ${target.title || 'Untitled'}` : 'New note'}
        />
        <p className="status">{status || target?.title || 'A new note'}</p>
    </>
}

const IDLE_FOCUS_MINUTES = 25

/** Fullscreen video or slides are the last place a bubble belongs, so the overlay steps aside. */
function useFullscreen() {
    const [fullscreen, setFullscreen] = useState(() => document.fullscreenElement !== null)
    useEffect(() => {
        const listener = () => setFullscreen(document.fullscreenElement !== null)
        document.addEventListener('fullscreenchange', listener)
        return () => document.removeEventListener('fullscreenchange', listener)
    }, [])
    return fullscreen
}

function FocusTimer() {
    const [focus] = useStorageValue('focus', EMPTY_FOCUS)
    const [now, setNow] = useState(Date.now)
    const session = focus.session

    useEffect(() => {
        if (session?.status !== 'running') return
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [session?.status])

    // Between sessions it shrinks to a faint icon rather than a timer reading 00:00, which would be
    // something to look at for no reason.
    if (!session || session.status === 'finished') {
        return <button className="timer is-idle" onClick={() => void startFocus(IDLE_FOCUS_MINUTES)} aria-label={`Start a ${IDLE_FOCUS_MINUTES}-minute focus session`}>
            <TimerIcon size={16} />
            <span className="label">Focus · {IDLE_FOCUS_MINUTES} min</span>
        </button>
    }

    const remaining = session.status === 'running'
        ? Math.min(session.durationMs, Math.max(0, (session.endsAt ?? now) - now))
        : session.remainingMs
    const seconds = Math.ceil(remaining / 1000)
    const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    const progress = session.durationMs > 0 ? 1 - remaining / session.durationMs : 0

    const pauseResume = () => changeStored('focus', EMPTY_FOCUS, (value) => {
        const active = value.session
        if (!active || active.status === 'finished') return value
        return {
            ...value, session: active.status === 'running'
                ? { ...active, status: 'paused' as const, remainingMs: Math.max(0, (active.endsAt ?? Date.now()) - Date.now()), endsAt: null }
                : { ...active, status: 'running' as const, endsAt: Date.now() + active.remainingMs },
        }
    })

    return <div className="timer" data-mode={session.mode} role="status" aria-label={`${session.mode === 'break' ? 'Break' : 'Focus'}: ${time} remaining`}>
        <span className="ring" style={{ '--progress': progress } as CSSProperties} aria-hidden="true" />
        <time>{time}</time>
        <span className="label">{session.mode === 'break' ? 'Break' : session.label}</span>
        <button className="icon-button" onClick={() => void pauseResume()} aria-label={session.status === 'running' ? 'Pause focus' : 'Resume focus'}>
            {session.status === 'running' ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
        </button>
    </div>
}

export default function OverlayPanel() {
    const [settings, setSettings] = useStorageValue('settings', DEFAULT_SETTINGS)
    const [open, setOpen] = useStorageValue('overlay:open', null)
    const [todos] = useStorageValue('todos', [])
    const theme = useTheme()
    const fullscreen = useFullscreen()
    const panelRef = useRef<HTMLDivElement>(null)

    // Escape closes, and so does a click on the page. Dismissing has to be as cheap as opening, or
    // the panel becomes something to manage instead of something to glance at.
    useEffect(() => {
        if (!open) return
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null) }
        const onDown = (event: MouseEvent) => {
            // `event.target` is retargeted to the shadow host for listeners outside the shadow root,
            // so testing it against the panel would match every click — including the panel's own.
            // composedPath() crosses the boundary and reports the element actually clicked.
            const panel = panelRef.current
            if (panel && event.composedPath().includes(panel)) return
            setOpen(null)
        }
        window.addEventListener('keydown', onKey, true)
        document.addEventListener('mousedown', onDown, true)
        return () => {
            window.removeEventListener('keydown', onKey, true)
            document.removeEventListener('mousedown', onDown, true)
        }
    }, [open, setOpen])

    const openCount = todos.filter((todo) => !todo.done).length

    const hideHere = () => {
        const host = window.location.hostname.replace(/^www\./, '').toLowerCase()
        setOpen(null)
        setSettings({ ...settings, overlayBlockedHosts: [...new Set([...settings.overlayBlockedHosts, host])] })
    }

    const captureTask = async () => {
        const todo = taskFromPage(pageContext())
        await changeStored('todos', [], (items) => [...items, todo])
    }

    const captureNote = async () => {
        const selection = window.getSelection()?.toString().trim()
        const note = noteFromPage({ ...pageContext(), ...(selection ? { selection } : {}) })
        await changeStored('notes', [], (items) => [...items, note])
    }

    if (fullscreen) return null

    return <div className="root" data-theme={theme} data-side={settings.overlaySide}>
        <FocusTimer />

        {open ? (
            <div className="panel" ref={panelRef} role="dialog" aria-label="Tasks and notes">
                <div className="panel-head">
                    <div className="panel-tabs" role="tablist">
                        {(['todo', 'notes'] as const).map((tab) => (
                            <button key={tab} role="tab" aria-selected={open === tab} onClick={() => setOpen(tab)}>
                                {tab === 'todo' ? 'Tasks' : 'Note'}
                            </button>
                        ))}
                    </div>
                    <button className="icon-button" onClick={hideHere} aria-label="Hide on this site" title="Hide on this site">
                        <EyeSlashIcon size={14} />
                    </button>
                    <button className="icon-button" onClick={() => setOpen(null)} aria-label="Close">
                        <XIcon size={14} />
                    </button>
                </div>
                <div className="panel-body">
                    {open === 'todo' ? <TodoPane /> : <NotesPane />}
                </div>
                <div className="capture-row">
                    <button onClick={() => void captureTask()}>Save page as task</button>
                    <button onClick={() => void captureNote()}>Save as note</button>
                </div>
            </div>
        ) : (
            <div className="handle">
                <button onClick={() => setOpen('todo')} aria-label={`Tasks${openCount ? `, ${openCount} open` : ''}`} title="Tasks">
                    <ChecksIcon size={17} />
                    {openCount > 0 && <span className="count">{openCount > 99 ? '99+' : openCount}</span>}
                </button>
                <button onClick={() => setOpen('notes')} aria-label="Note" title="Note">
                    <NotePencilIcon size={17} />
                </button>
            </div>
        )}
    </div>
}
