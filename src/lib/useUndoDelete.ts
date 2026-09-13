import { changeStored } from './productivity'
import { useToast } from './useToast'
import type { StorageSchema } from './storage'

type ListKey = 'todos' | 'shortcuts' | 'aiTools' | 'notes' | 'workspaces'
export function useUndoDelete() {
    const toast = useToast()
    return async <K extends ListKey>(key: K, id: string, label: string) => {
        let removed: StorageSchema[K][number] | undefined
        let index = -1
        try {
            await changeStored(key, [] as unknown as StorageSchema[K], (items) => {
                index = items.findIndex((item) => item.id === id)
                removed = items[index]
                return items.filter((item) => item.id !== id) as StorageSchema[K]
            })
            if (!removed) return
            toast(`${label} deleted`, { label: 'Undo', run: async () => {
                await changeStored(key, [] as unknown as StorageSchema[K], (items) => {
                    if (!removed || items.some((item) => item.id === id)) return items
                    const next = [...items]
                    next.splice(Math.min(index, next.length), 0, removed)
                    return next as StorageSchema[K]
                })
            } })
        } catch { toast('Could not delete. Please try again.') }
    }
}
