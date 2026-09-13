import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { AppWindowIcon as AppWindow } from '@phosphor-icons/react/dist/csr/AppWindow'
import { BookmarkSimpleIcon as Bookmark } from '@phosphor-icons/react/dist/csr/BookmarkSimple'
import { MicrophoneIcon as Mic } from '@phosphor-icons/react/dist/csr/Microphone'
import { MagnifyingGlassIcon as Search } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { DEFAULT_SETTINGS, faviconFor, type SearchEngine } from '../lib/storage'
import { useStorageValue } from '../lib/useStorageValue'
import { directUrlFor, parseBookmarkTarget, parseCommand, searchUrl } from '../lib/commandParser'
import { fetchSuggestions, hasSuggestPermission, hostPermissionFor, requestSuggestPermission } from '../lib/searchSuggestions'
import { searchLocalSources, type PaletteResult } from '../lib/commandPalette'
import { useVoiceSearch } from '../lib/voiceSearch'
import { useToast } from '../lib/useToast'

const ENGINES: { id: SearchEngine; label: string; homepage: string }[] = [
    { id: 'google', label: 'Google', homepage: 'https://google.com' },
    { id: 'duckduckgo', label: 'DuckDuckGo', homepage: 'https://duckduckgo.com' },
    { id: 'bing', label: 'Bing', homepage: 'https://bing.com' },
    { id: 'brave', label: 'Brave', homepage: 'https://search.brave.com' },
    { id: 'youtube', label: 'YouTube', homepage: 'https://youtube.com' },
    { id: 'wikipedia', label: 'Wikipedia', homepage: 'https://wikipedia.org' },
]

const SUGGEST_DEBOUNCE_MS = 200

type ListItem = { key: string; kind: PaletteResult['kind'] | 'search'; label: string; result?: PaletteResult }

export default function CommandBar() {
    const [settings, setSettings] = useStorageValue('settings', DEFAULT_SETTINGS)
    const [todos, setTodos] = useStorageValue('todos', [])
    const [shortcuts] = useStorageValue('shortcuts', [])
    const [aiTools] = useStorageValue('aiTools', [])
    const [value, setValue] = useState('')
    const [items, setItems] = useState<ListItem[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [activeIndex, setActiveIndex] = useState(-1)
    const [needsSuggestPermission, setNeedsSuggestPermission] = useState(false)
    const [sourcePermissions, setSourcePermissions] = useState({ tabs: false, bookmarks: false })
    const inputRef = useRef<HTMLInputElement>(null)
    const showToast = useToast()

    useEffect(() => {
        const checkPerms = () => {
            chrome.permissions.contains({ permissions: ['tabs'] }, (tabs) =>
                setSourcePermissions((prev) => ({ ...prev, tabs })),
            )
            chrome.permissions.contains({ permissions: ['bookmarks'] }, (bookmarks) =>
                setSourcePermissions((prev) => ({ ...prev, bookmarks })),
            )
        }
        checkPerms()
        chrome.permissions.onAdded.addListener(checkPerms)
        chrome.permissions.onRemoved.addListener(checkPerms)
        return () => {
            chrome.permissions.onAdded.removeListener(checkPerms)
            chrome.permissions.onRemoved.removeListener(checkPerms)
        }
    }, [])

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                inputRef.current?.focus()
                return
            }
            const target = e.target as HTMLElement | null
            const isTyping =
                target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
            if (e.key === '/' && !isTyping) {
                e.preventDefault()
                inputRef.current?.focus()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    // Debounced unified results: your own tabs/shortcuts/AI tools/bookmarks first, then web
    // search suggestions as a fallback — only for bare search queries (not t:/b:/@ commands).
    useEffect(() => {
        const controller = new AbortController()
        const timer = setTimeout(async () => {
            const command = parseCommand(value)
            if (!command || command.type !== 'search' || directUrlFor(command.query)) {
                setItems([])
                return
            }

            const local = await searchLocalSources(command.query, {
                tabsGranted: sourcePermissions.tabs,
                bookmarksGranted: sourcePermissions.bookmarks,
                shortcuts,
                aiTools,
            })
            if (controller.signal.aborted) return

            const localItems: ListItem[] = local.map((r) => ({ key: r.key, kind: r.kind, label: r.label, result: r }))

            let searchItems: ListItem[] = []
            if (settings.searchSuggestionsEnabled) {
                const suggestions = await fetchSuggestions(settings.searchEngine, command.query, controller.signal)
                if (controller.signal.aborted) return
                searchItems = suggestions.map((s) => ({ key: `search-${s}`, kind: 'search', label: s }))
            }

            setItems([...localItems, ...searchItems])
            setShowSuggestions(true)
            setActiveIndex(-1)
        }, SUGGEST_DEBOUNCE_MS)

        return () => {
            controller.abort()
            clearTimeout(timer)
        }
    }, [value, settings.searchEngine, settings.searchSuggestionsEnabled, sourcePermissions, shortcuts, aiTools])

    useEffect(() => {
        let cancelled = false
        hasSuggestPermission(settings.searchEngine).then((granted) => {
            if (!cancelled) setNeedsSuggestPermission(!granted)
        })
        return () => {
            cancelled = true
        }
    }, [settings.searchEngine])

    const runSearch = (query: string) => {
        const direct = directUrlFor(query)
        window.location.assign(direct ?? searchUrl(settings.searchEngine, query))
    }

    const selectItem = (item: ListItem) => {
        if (item.kind === 'search') {
            runSearch(item.label)
            return
        }
        const result = item.result!
        if (result.kind === 'tab' && result.tabId !== undefined && result.windowId !== undefined) {
            chrome.tabs.update(result.tabId, { active: true })
            chrome.windows.update(result.windowId, { focused: true })
            return
        }
        window.location.assign(result.url)
    }

    const submit = (raw: string) => {
        const command = parseCommand(raw)
        if (!command) return

        if (command.type === 'todo') {
            setTodos([
                ...todos,
                { id: crypto.randomUUID(), text: command.text, done: false, pinned: false, createdAt: Date.now() },
            ])
            showToast(`Added to-do: "${command.text}"`)
            setValue('')
            return
        }

        if (command.type === 'bookmark') {
            chrome.permissions.contains({ permissions: ['bookmarks'] }, (granted) => {
                if (!granted) {
                    showToast('Enable bookmark access from the Bookmarks card first')
                    return
                }
                const { url, title } = parseBookmarkTarget(command.title)
                chrome.bookmarks.create({ title, url })
                showToast(`Bookmarked "${title}"`)
            })
            setValue('')
            return
        }

        if (command.type === 'shortcut') {
            const match = shortcuts.find((s) => s.label.toLowerCase().startsWith(command.name.toLowerCase()))
            if (!match) {
                showToast(`No shortcut named "${command.name}"`)
                return
            }
            window.location.assign(match.url)
            return
        }

        runSearch(command.query)
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        if (activeIndex >= 0 && items[activeIndex]) {
            selectItem(items[activeIndex])
            return
        }
        submit(value)
    }

    const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (!showSuggestions || items.length === 0) return
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex((i) => (i + 1) % items.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((i) => (i - 1 + items.length) % items.length)
        } else if (e.key === 'Escape') {
            setShowSuggestions(false)
        }
    }

    const enableNativeSuggestions = async () => {
        const granted = await requestSuggestPermission(settings.searchEngine)
        if (granted) setNeedsSuggestPermission(false)
    }

    const cycleEngine = () => {
        const idx = ENGINES.findIndex((e) => e.id === settings.searchEngine)
        const next = ENGINES[(idx + 1) % ENGINES.length]
        setSettings({ ...settings, searchEngine: next.id })
    }

    const voice = useVoiceSearch((text, isFinal) => {
        setValue(text)
        if (isFinal) submit(text)
    })

    const currentEngine = ENGINES.find((e) => e.id === settings.searchEngine)!

    return (
        <form onSubmit={handleSubmit} className="command-bar relative w-full">
            <div className="search-surface glass-surface flex items-center gap-2 rounded-full border border-black/10 px-4 py-2.5 shadow-sm ring-0 transition focus-within:ring-2 focus-within:ring-black/20 dark:border-white/10 dark:focus-within:ring-white/30">
                {settings.hideSearchEngines ? (
                    <button
                        type="button"
                        onClick={cycleEngine}
                        title={`${currentEngine.label} — click to switch`}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    >
                        <img src={faviconFor(currentEngine.homepage)} alt="" className="h-4 w-4" />
                    </button>
                ) : (
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button
                                type="button"
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                                aria-label="Choose search engine"
                            >
                                <img src={faviconFor(currentEngine.homepage)} alt="" className="h-4 w-4" />
                            </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content
                                align="start"
                                sideOffset={8}
                                className="dropdown-animate z-10 w-40 rounded-xl border border-black/10 bg-white p-1 shadow-lg outline-none dark:border-white/10 dark:bg-neutral-900"
                            >
                                {ENGINES.map((engine) => (
                                    <DropdownMenu.Item
                                        key={engine.id}
                                        onSelect={() => setSettings({ ...settings, searchEngine: engine.id })}
                                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none hover:bg-black/5 focus:bg-black/5 dark:hover:bg-white/10 dark:focus:bg-white/10"
                                    >
                                        <img src={faviconFor(engine.homepage)} alt="" className="h-4 w-4" />
                                        {engine.label}
                                    </DropdownMenu.Item>
                                ))}
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                )}
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={onInputKeyDown}
                    onFocus={() => items.length > 0 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    aria-label="Search the web or enter a command"
                    placeholder="Search anything, or make something happen…"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                />
                {voice.supported && !settings.hideMicrophone && (
                    <button
                        type="button"
                        onClick={voice.toggle}
                        aria-label={voice.listening ? 'Stop voice search' : 'Voice search'}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                            voice.listening ? 'text-red-500' : 'text-neutral-400'
                        }`}
                    >
                        <Mic className="h-4 w-4" />
                    </button>
                )}
                <kbd className="hidden shrink-0 rounded border border-black/10 px-1.5 py-0.5 text-[10px] text-neutral-400 sm:block dark:border-white/10">
                    ⌘K
                </kbd>
            </div>

            {showSuggestions && items.length > 0 && (
                <div className="dropdown-animate absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-neutral-900">
                    <ul className="themed-scrollbar max-h-96 overflow-y-auto">
                        {items.map((item, i) => (
                            <li key={item.key}>
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => selectItem(item)}
                                    className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
                                        i === activeIndex ? 'bg-black/5 dark:bg-white/10' : ''
                                    }`}
                                >
                                    {item.kind === 'search' && <Search className="h-3.5 w-3.5 shrink-0 text-neutral-400" />}
                                    {item.kind === 'tab' && (
                                        <>
                                            {item.result?.favicon ? (
                                                <img src={item.result.favicon} alt="" className="h-3.5 w-3.5 shrink-0" />
                                            ) : (
                                                <AppWindow className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                                            )}
                                        </>
                                    )}
                                    {item.kind === 'bookmark' && <Bookmark className="h-3.5 w-3.5 shrink-0 text-neutral-400" />}
                                    {(item.kind === 'shortcut' || item.kind === 'aiTool') && (
                                        <img
                                            src={item.result?.favicon || faviconFor(item.result?.url ?? '')}
                                            alt=""
                                            className="h-3.5 w-3.5 shrink-0"
                                        />
                                    )}
                                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                    {item.kind !== 'search' && (
                                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-neutral-400">
                                            {item.kind === 'tab' ? 'Tab' : item.kind === 'aiTool' ? 'AI tool' : item.kind}
                                        </span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {needsSuggestPermission && hostPermissionFor(settings.searchEngine) && (
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={enableNativeSuggestions}
                            className="block w-full border-t border-black/10 px-4 py-2 text-left text-xs text-neutral-400 dark:border-white/10"
                        >
                            Showing Wikipedia suggestions — enable {currentEngine.label}'s own suggestions
                        </button>
                    )}
                    {!sourcePermissions.tabs && (
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => chrome.permissions.request({ permissions: ['tabs'] })}
                            className="block w-full border-t border-black/10 px-4 py-2 text-left text-xs text-neutral-400 dark:border-white/10"
                        >
                            Enable to also search your open tabs
                        </button>
                    )}
                </div>
            )}
        </form>
    )
}
