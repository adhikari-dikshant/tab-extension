import { useEffect, useMemo, useState } from 'react'
import { BookmarkSimpleIcon as Bookmark } from '@phosphor-icons/react/dist/csr/BookmarkSimple'
import { CaretDownIcon as ChevronDown } from '@phosphor-icons/react/dist/csr/CaretDown'
import { ClockIcon as Clock } from '@phosphor-icons/react/dist/csr/Clock'
import { FolderIcon as Folder } from '@phosphor-icons/react/dist/csr/Folder'
import { PencilSimpleIcon as Pencil } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { MagnifyingGlassIcon as Search } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { CardEmpty, CardSkeleton } from './CardState'
import { faviconFor } from '../lib/storage'

interface FlatBookmark {
    id: string
    title: string
    url: string
    folder: string
    dateAdded: number
}

const RECENTLY_ADDED = 'Recently added'
const REQUIRED_PERMISSIONS: chrome.runtime.ManifestPermission[] = ['bookmarks']

function flatten(nodes: chrome.bookmarks.BookmarkTreeNode[], folder = 'Bookmarks'): FlatBookmark[] {
    let out: FlatBookmark[] = []
    for (const node of nodes) {
        if (node.url) {
            out.push({ id: node.id, title: node.title || node.url, url: node.url, folder, dateAdded: node.dateAdded ?? 0 })
        } else if (node.children) {
            out = out.concat(flatten(node.children, node.title || folder))
        }
    }
    return out
}

function Favicon({ url, className }: { url: string; className: string }) {
    const [src, setSrc] = useState(() => `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`)
    const [stage, setStage] = useState<'cached' | 'google' | 'fallback'>('cached')

    const onError = () => {
        if (stage === 'cached') {
            setStage('google')
            setSrc(faviconFor(url))
        } else if (stage === 'google') {
            setStage('fallback')
        }
    }

    if (stage === 'fallback') {
        return (
            <span
                className={`flex shrink-0 items-center justify-center rounded-full bg-black/10 text-neutral-400 dark:bg-white/10 ${className}`}
            >
                <Bookmark className="h-[55%] w-[55%]" />
            </span>
        )
    }

    return <img src={src} alt="" onError={onError} className={className} />
}

export default function BookmarksPanel() {
    const [permission, setPermission] = useState<'checking' | 'granted' | 'denied'>('checking')
    const [bookmarks, setBookmarks] = useState<FlatBookmark[] | null>(null)
    const [recent, setRecent] = useState<FlatBookmark[]>([])
    const [layout, setLayout] = useState<'list' | 'grid'>('grid')
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
    const [sortBy, setSortBy] = useState<'title' | 'date'>('title')
    const [query, setQuery] = useState('')
    const [editing, setEditing] = useState<FlatBookmark | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const [editUrl, setEditUrl] = useState('')

    const load = () => {
        chrome.bookmarks.getTree((tree) => setBookmarks(flatten(tree)))
        chrome.bookmarks.getRecent(8, (nodes) =>
            setRecent(
                nodes.map((n) => ({
                    id: n.id,
                    title: n.title || n.url || '',
                    url: n.url ?? '',
                    folder: RECENTLY_ADDED,
                    dateAdded: n.dateAdded ?? 0,
                })),
            ),
        )
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

    const remove = (id: string) => {
        chrome.bookmarks.remove(id, load)
    }

    const startEdit = (bookmark: FlatBookmark) => {
        setEditing(bookmark)
        setEditTitle(bookmark.title)
        setEditUrl(bookmark.url)
    }

    const saveEdit = () => {
        if (!editing) return
        const url = /^https?:\/\//i.test(editUrl) ? editUrl : `https://${editUrl}`
        chrome.bookmarks.update(editing.id, { title: editTitle, url }, () => {
            setEditing(null)
            load()
        })
    }

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase()
        const matches = (b: FlatBookmark) => !q || b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)

        const sortItems = (items: FlatBookmark[]) =>
            [...items].sort((a, b) =>
                sortBy === 'title' ? a.title.localeCompare(b.title) : b.dateAdded - a.dateAdded,
            )

        const acc: Record<string, FlatBookmark[]> = {}

        const filteredRecent = recent.filter(matches)
        if (filteredRecent.length > 0) acc[RECENTLY_ADDED] = filteredRecent // already recency-ordered

        for (const b of bookmarks ?? []) {
            if (!matches(b)) continue
                ; (acc[b.folder] ??= []).push(b)
        }
        for (const folder of Object.keys(acc)) {
            if (folder !== RECENTLY_ADDED) acc[folder] = sortItems(acc[folder])
        }
        return acc
    }, [bookmarks, recent, query, sortBy])

    if (permission === 'checking' || (permission === 'granted' && bookmarks === null)) {
        return <CardSkeleton />
    }

    if (permission === 'denied') {
        return (
            <CardEmpty>
                <p className="mb-2">See your browser bookmarks here — nothing is sent anywhere, it stays local.</p>
                <button
                    type="button"
                    onClick={requestAccess}
                    className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-black"
                >
                    Enable bookmarks
                </button>
            </CardEmpty>
        )
    }

    return (
        <div>
            <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600 dark:text-neutral-300" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search bookmarks"
                    placeholder="Search bookmarks…"
                    className="w-full rounded-full border border-black/10 bg-transparent py-2 pl-9 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-600 dark:border-white/10 dark:text-neutral-100 dark:placeholder:text-neutral-400"
                />
            </div>

            <div className="mb-4 flex items-center justify-end gap-3 text-xs text-neutral-600 dark:text-neutral-300">
                <button type="button" onClick={() => setSortBy(sortBy === 'title' ? 'date' : 'title')}>
                    Sort: {sortBy === 'title' ? 'A–Z' : 'Newest'}
                </button>
                <button type="button" onClick={() => setLayout(layout === 'list' ? 'grid' : 'list')}>
                    {layout === 'list' ? 'Grid view' : 'List view'}
                </button>
            </div>

            {bookmarks?.length === 0 ? (
                <CardEmpty>No bookmarks yet — add some from your browser's bookmark bar.</CardEmpty>
            ) : Object.keys(groups).length === 0 ? (
                <CardEmpty>No bookmarks match "{query}".</CardEmpty>
            ) : (
                <div className="themed-scrollbar max-h-[60vh] space-y-8 overflow-y-auto">
                    {Object.entries(groups).map(([folder, items]) => {
                        const isCollapsed = collapsed[folder]
                        return (
                            <div key={folder}>
                                <button
                                    type="button"
                                    onClick={() => setCollapsed((c) => ({ ...c, [folder]: !isCollapsed }))}
                                    aria-expanded={!isCollapsed}
                                    className="mb-5 flex w-full items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-100"
                                >
                                    <ChevronDown
                                        className={`h-3.5 w-3.5 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                                    />
                                    {folder === RECENTLY_ADDED ? (
                                        <Clock className="h-3.5 w-3.5 shrink-0" />
                                    ) : (
                                        <Folder className="h-3.5 w-3.5 shrink-0" />
                                    )}
                                    {folder}
                                </button>

                                {!isCollapsed &&
                                    (layout === 'list' ? (
                                        <ul className="space-y-4">
                                            {items.map((b) => (
                                                <li key={`${folder}-${b.id}`} className="group flex items-center gap-2 text-sm">
                                                    <Favicon url={b.url} className="h-4 w-4 shrink-0" />
                                                    <a href={b.url} className="min-w-0 flex-1 truncate text-neutral-900 hover:underline dark:text-neutral-200">
                                                        {b.title}
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => startEdit(b)}
                                                        aria-label="Edit bookmark"
                                                        className="hidden text-neutral-600 group-hover:inline-flex group-focus-within:inline-flex dark:text-neutral-300"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => remove(b.id)}
                                                        aria-label="Delete bookmark"
                                                        className="hidden text-neutral-600 group-hover:inline group-focus-within:inline dark:text-neutral-300"
                                                    >
                                                        ×
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-x-3 gap-y-9">
                                            {items.map((b) => (
                                                <div key={`${folder}-${b.id}`} className="group relative flex flex-col items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => window.open(b.url, '_self')}
                                                        onContextMenu={(e) => {
                                                            e.preventDefault()
                                                            startEdit(b)
                                                        }}
                                                        title={b.title}
                                                    >
                                                        <Favicon
                                                            url={b.url}
                                                            className="h-14 w-14 rounded-full bg-black/5 p-3 dark:bg-white/10"
                                                        />
                                                    </button>
                                                    <span className="w-full truncate text-center text-xs text-neutral-900 dark:text-neutral-200">
                                                        {b.title}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => remove(b.id)}
                                                        aria-label="Delete bookmark"
                                                        className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[10px] leading-none text-white group-hover:flex"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                            </div>
                        )
                    })}
                </div>
            )}

            {editing && (
                <div className="mt-3 space-y-4 rounded-lg border border-black/10 p-2 dark:border-white/10">
                    <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Title"
                        className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
                    />
                    <input
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        placeholder="URL"
                        className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
                    />
                    <div className="flex justify-end gap-2 text-sm">
                        <button type="button" onClick={() => setEditing(null)} className="text-neutral-600 dark:text-neutral-300">
                            Cancel
                        </button>
                        <button type="button" onClick={saveEdit} className="font-medium">
                            Save
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
