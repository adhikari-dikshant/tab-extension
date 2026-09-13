import { useEffect, useState } from 'react'
import { Offcanvas } from './Offcanvas'
import WorkspacesPanel from './WorkspacesPanel'
import { AppWindowIcon as AppWindow } from '@phosphor-icons/react/dist/csr/AppWindow'
import { ClockCounterClockwiseIcon as History } from '@phosphor-icons/react/dist/csr/ClockCounterClockwise'
import { faviconFor } from '../lib/storage'

const REQUIRED_PERMISSIONS: chrome.runtime.ManifestPermission[] = ['sessions']

function timeAgo(ms: number) {
    const mins = Math.floor((Date.now() - ms) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
}

export default function RecentlyClosedButton() {
    const [view, setView] = useState<'recent' | 'saved'>('recent')
    const [open, setOpen] = useState(false)
    const [permission, setPermission] = useState<'checking' | 'granted' | 'denied'>('checking')
    const [sessions, setSessions] = useState<chrome.sessions.Session[]>([])

    const load = () => {
        chrome.sessions.getRecentlyClosed({ maxResults: 15 }, setSessions)
    }

    useEffect(() => {
        chrome.permissions.contains({ permissions: REQUIRED_PERMISSIONS }, (granted) => {
            setPermission(granted ? 'granted' : 'denied')
            if (granted) load()
        })
    }, [])

    const requestAccess = () => {
        chrome.permissions.request({ permissions: REQUIRED_PERMISSIONS }, (granted) => {
            setPermission(granted ? 'granted' : 'denied')
            if (granted) load()
        })
    }

    const restore = (sessionId: string | undefined) => {
        chrome.sessions.restore(sessionId, () => {
            load()
            setOpen(false)
        })
    }

    return (
        <Offcanvas
            title="Recent"
            description="Pick up where you left off. Reopen a tab or window."
            icon={History}
            open={open}
            onOpenChange={(next) => {
                setOpen(next)
                if (next && permission === 'granted') load()
            }}
            trigger={<button type="button" aria-label="Recently closed"><History size={20} /></button>}
        >
            <div className="productivity-tabs" aria-label="Recent or saved tabs">
                <button aria-pressed={view === 'recent'} onClick={() => setView('recent')}>Recently closed</button>
                <button aria-pressed={view === 'saved'} onClick={() => setView('saved')}>Saved workspaces</button>
            </div>
            {view === 'saved' ? <WorkspacesPanel /> : permission === 'checking' ? (
                <p className="offcanvas-empty">…</p>
            ) : permission === 'denied' ? (
                <div className="offcanvas-empty">
                    <p className="mb-4">
                        See tabs you've closed recently and reopen them in one click.
                    </p>
                    <button
                        type="button"
                        onClick={requestAccess}
                        className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-black"
                    >
                        Enable recently closed
                    </button>
                </div>
            ) : sessions.length === 0 ? (
                <p className="offcanvas-empty">Nothing closed recently.</p>
            ) : (
                <ul className="recent-list">
                    {sessions.map((session) => {
                        const id = session.tab ? session.tab.sessionId : session.window?.sessionId
                        const isWindow = !session.tab && !!session.window
                        return (
                            <li key={id}>
                                <button
                                    type="button"
                                    onClick={() => restore(id)}
                                    className="recent-entry"
                                >
                                    {isWindow ? (
                                        <AppWindow className="h-4 w-4 shrink-0 text-neutral-400" />
                                    ) : (
                                        <img
                                            src={faviconFor(session.tab?.url ?? '')}
                                            alt=""
                                            className="h-4 w-4 shrink-0"
                                        />
                                    )}
                                    <span className="min-w-0 flex-1 truncate">
                                        {isWindow
                                            ? `Window (${session.window?.tabs?.length ?? 0} tabs)`
                                            : session.tab?.title || session.tab?.url}
                                    </span>
                                    <span className="recent-time">
                                        {timeAgo(session.lastModified * 1000)}
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </Offcanvas>
    )
}
