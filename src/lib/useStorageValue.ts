import { useCallback, useEffect, useState } from 'react'
import { getStorageValue, onStorageValueChanged, setStorageValue, type StorageSchema } from './storage'

function isPlainObject(x: unknown): x is Record<string, unknown> {
    return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/** Shallow-merges a stored value over the default when both are plain objects, so adding a new
 * field to a schema (e.g. Settings) doesn't come back `undefined` for data persisted before that
 * field existed. Arrays/primitives are returned as-is — only object shapes need this safety net. */
function withDefaults<T>(defaultValue: T, stored: T): T {
    if (isPlainObject(defaultValue) && isPlainObject(stored)) {
        return { ...defaultValue, ...stored } as T
    }
    return stored
}

/**
 * Reads a storage key, subscribes to chrome.storage.onChanged for it, and writes
 * straight through to storage on update. Local state only ever changes via the
 * onChanged callback, so it can't drift from what's actually persisted.
 *
 * Returns [value, update, loading] — `loading` is only true until the initial
 * read resolves, so cards can tell "haven't read storage yet" from "read it, it's empty".
 */
export function useStorageValue<K extends keyof StorageSchema>(
    key: K,
    defaultValue: StorageSchema[K],
) {
    const [value, setValue] = useState<StorageSchema[K]>(defaultValue)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        getStorageValue(key).then((stored) => {
            if (cancelled) return
            if (stored !== undefined) setValue(withDefaults(defaultValue, stored))
            setLoading(false)
        })

        const unsubscribe = onStorageValueChanged(key, (newValue) => {
            if (newValue !== undefined) setValue(withDefaults(defaultValue, newValue))
        })

        return () => {
            cancelled = true
            unsubscribe()
        }
        // defaultValue is intentionally excluded: callers commonly pass a fresh object/array
        // literal each render, and re-running this effect on every render would defeat the
        // "read once, then only react to onChanged" design.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key])

    const update = useCallback((next: StorageSchema[K]) => {
        void setStorageValue(key, next)
    }, [key])

    return [value, update, loading] as const
}
