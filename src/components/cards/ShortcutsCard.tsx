import { useEffect, useRef, useState, type DragEvent } from 'react'
import { BentoCard } from '../BentoGrid'
import { CardEmpty, CardSkeleton } from '../CardState'
import { ShortcutIcon } from '../ShortcutIcon'
import { sanitizeSvgMarkup } from '../../lib/sanitizeSvg'
import { useStorageValue } from '../../lib/useStorageValue'

const MAX_SHORTCUTS = 50

export default function ShortcutsCard() {
    const [shortcuts, setShortcuts, loading] = useStorageValue('shortcuts', [])
    const [adding, setAdding] = useState(false)
    const [label, setLabel] = useState('')
    const [url, setUrl] = useState('')
    const [customIcon, setCustomIcon] = useState<string | undefined>(undefined)
    const [dragId, setDragId] = useState<string | null>(null)
    const [altHeld, setAltHeld] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Alt+1-9 jumps straight to a shortcut; number badges only appear after holding Alt briefly,
    // so a quick Alt-tab or Alt+Tab-away doesn't flash badges for no reason.
    useEffect(() => {
        let showTimer: ReturnType<typeof setTimeout> | null = null

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Alt' && !altHeld) {
                showTimer = setTimeout(() => setAltHeld(true), 300)
                return
            }
            if (e.altKey && /^[1-9]$/.test(e.key)) {
                const index = Number(e.key) - 1
                const target = shortcuts[index]
                if (target) {
                    e.preventDefault()
                    window.location.href = target.url
                }
            }
        }
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                if (showTimer) clearTimeout(showTimer)
                setAltHeld(false)
            }
        }

        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
            if (showTimer) clearTimeout(showTimer)
        }
    }, [shortcuts, altHeld])

    const startAdd = () => {
        setLabel('')
        setUrl('')
        setCustomIcon(undefined)
        setAdding(true)
    }

    const handleIconFile = async (file: File) => {
        if (file.type === 'image/svg+xml') {
            const text = sanitizeSvgMarkup(await file.text())
            setCustomIcon(`data:image/svg+xml;base64,${btoa(text)}`)
            return
        }
        if (!file.type.startsWith('image/')) return
        const reader = new FileReader()
        reader.onload = () => setCustomIcon(reader.result as string)
        reader.readAsDataURL(file)
    }

    const save = () => {
        if (!label.trim() || !url.trim() || shortcuts.length >= MAX_SHORTCUTS) return
        const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`
        setShortcuts([...shortcuts, { id: crypto.randomUUID(), label, url: normalizedUrl, icon: customIcon }])
        setAdding(false)
    }

    const remove = (id: string) => {
        setShortcuts(shortcuts.filter((s) => s.id !== id))
    }

    const onDrop = (targetId: string) => (e: DragEvent) => {
        e.preventDefault()
        if (!dragId || dragId === targetId) return
        const fromIndex = shortcuts.findIndex((s) => s.id === dragId)
        const toIndex = shortcuts.findIndex((s) => s.id === targetId)
        if (fromIndex === -1 || toIndex === -1) return
        const next = [...shortcuts]
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        setShortcuts(next)
        setDragId(null)
    }

    return (
        <BentoCard title="Shortcuts">
            {loading ? (
                <CardSkeleton />
            ) : (
                <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-3">
                        {shortcuts.map((shortcut, index) => (
                            <div
                                key={shortcut.id}
                                draggable
                                onDragStart={() => setDragId(shortcut.id)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={onDrop(shortcut.id)}
                                className="group relative flex flex-col items-center gap-1"
                            >
                                <button
                                    type="button"
                                    onClick={() => window.open(shortcut.url, '_self')}
                                    title={shortcut.label}
                                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10"
                                >
                                    <ShortcutIcon
                                        url={shortcut.url}
                                        label={shortcut.label}
                                        icon={shortcut.icon}
                                        className="h-5 w-5"
                                    />
                                </button>
                                {altHeld && index < 9 && (
                                    <span className="pointer-events-none absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[9px] font-medium text-white dark:bg-white dark:text-black">
                                        {index + 1}
                                    </span>
                                )}
                                <span className="max-w-full truncate text-xs text-neutral-500 dark:text-neutral-400">
                                    {shortcut.label}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => remove(shortcut.id)}
                                    aria-label={`Remove ${shortcut.label}`}
                                    className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[10px] leading-none text-white group-hover:flex"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                        {shortcuts.length < MAX_SHORTCUTS && (
                            <button
                                type="button"
                                onClick={startAdd}
                                aria-label="Add shortcut"
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-black/20 text-neutral-400 dark:border-white/20"
                            >
                                +
                            </button>
                        )}
                    </div>

                    {shortcuts.length === 0 && !adding && (
                        <CardEmpty>Add your first shortcut with the + button above.</CardEmpty>
                    )}

                    {adding && (
                        <div className="space-y-2 rounded-lg border border-black/10 p-2 dark:border-white/10">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 dark:bg-white/10"
                                    aria-label="Upload custom icon"
                                >
                                    {customIcon ? (
                                        <img src={customIcon} alt="" className="h-5 w-5 rounded" />
                                    ) : (
                                        <span className="text-xs text-neutral-400">+</span>
                                    )}
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) void handleIconFile(file)
                                    }}
                                />
                                <input
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    placeholder="Label"
                                    className="min-w-0 flex-1 rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
                                />
                            </div>
                            <input
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="URL"
                                className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
                            />
                            <div className="flex justify-end gap-2 text-sm">
                                <button type="button" onClick={() => setAdding(false)} className="text-neutral-400">
                                    Cancel
                                </button>
                                <button type="button" onClick={save} className="font-medium">
                                    Save
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </BentoCard>
    )
}
