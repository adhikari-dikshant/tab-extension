import { useUndoDelete } from '../lib/useUndoDelete'
import { useState } from 'react'
import { PlusIcon as Plus } from '@phosphor-icons/react/dist/csr/Plus'
import { ShortcutIcon } from './ShortcutIcon'
import { useStorageValue } from '../lib/useStorageValue'

/** Shared editor for a stored list of {id,label,url,icon?} links — used by both the Shortcuts
 * and AI Tools settings panels, which only differ in which storage key they edit. */
export function EditableLinkListPanel({
    storageKey,
    emptyMessage,
}: {
    storageKey: 'shortcuts' | 'aiTools'
    emptyMessage: string
}) {
    const [items, setItems] = useStorageValue(storageKey, [])
    const [adding, setAdding] = useState(false)
    const [newLabel, setNewLabel] = useState('')
    const [newUrl, setNewUrl] = useState('')

    const updateLabel = (id: string, label: string) => {
        setItems(items.map((s) => (s.id === id ? { ...s, label } : s)))
    }

    const updateUrlDraft = (id: string, url: string) => {
        setItems(items.map((s) => (s.id === id ? { ...s, url } : s)))
    }

    const commitUrl = (id: string, url: string) => {
        const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
        setItems(items.map((s) => (s.id === id ? { ...s, url: normalized } : s)))
    }

    const undoDelete = useUndoDelete()
    const remove = (id: string) => { void undoDelete(storageKey, id, 'Shortcut') }

    const startAdd = () => {
        setNewLabel('')
        setNewUrl('')
        setAdding(true)
    }

    const saveAdd = () => {
        if (!newLabel.trim() || !newUrl.trim()) return
        const normalized = /^https?:\/\//i.test(newUrl) ? newUrl : `https://${newUrl}`
        setItems([...items, { id: crypto.randomUUID(), label: newLabel.trim(), url: normalized }])
        setAdding(false)
    }

    return (
        <div className="space-y-2">
            {items.length === 0 && !adding && <p className="text-xs text-neutral-400">{emptyMessage}</p>}

            {items.length > 0 && (
                <ul className="themed-scrollbar max-h-56 space-y-2 overflow-y-auto">
                    {items.map((s) => (
                        <li key={s.id} className="flex items-center gap-2">
                            <ShortcutIcon url={s.url} label={s.label} icon={s.icon} className="h-5 w-5 shrink-0" />
                            <input
                                value={s.label}
                                onChange={(e) => updateLabel(s.id, e.target.value)}
                                placeholder="Label"
                                className="w-24 min-w-0 rounded border border-black/10 bg-transparent px-2 py-1 text-xs outline-none dark:border-white/10"
                            />
                            <input
                                value={s.url}
                                onChange={(e) => updateUrlDraft(s.id, e.target.value)}
                                onBlur={(e) => commitUrl(s.id, e.target.value)}
                                placeholder="URL"
                                className="min-w-0 flex-1 rounded border border-black/10 bg-transparent px-2 py-1 text-xs outline-none dark:border-white/10"
                            />
                            <button
                                type="button"
                                onClick={() => remove(s.id)}
                                aria-label={`Remove ${s.label}`}
                                className="shrink-0 text-neutral-400"
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {adding ? (
                <div className="space-y-2 rounded-lg border border-black/10 p-2 dark:border-white/10">
                    <input
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Label"
                        className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-xs outline-none dark:border-white/10"
                    />
                    <input
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        placeholder="URL"
                        className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-xs outline-none dark:border-white/10"
                    />
                    <div className="flex justify-end gap-2 text-xs">
                        <button type="button" onClick={() => setAdding(false)} className="text-neutral-400">
                            Cancel
                        </button>
                        <button type="button" onClick={saveAdd} className="font-medium">
                            Save
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={startAdd}
                    className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                </button>
            )}
        </div>
    )
}
