import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ToastContext } from '../lib/useToast'

interface ToastItem {
    id: number
    message: string
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([])
    const nextId = useRef(0)

    const showToast = useCallback((message: string) => {
        const id = nextId.current++
        setToasts((prev) => [...prev, { id, message }])
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id))
        }, 2200)
    }, [])

    return (
        <ToastContext.Provider value={showToast}>
            {children}
            <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className="rounded-full bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-neutral-900"
                    >
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}
