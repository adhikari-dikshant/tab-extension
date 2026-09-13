import { useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { ToastContext, ToastViewContext, type ToastItem, type ToastAction } from '../lib/useToast'

export function ToastViewport({ panel = false }: { panel?: boolean }) {
    const { toasts, runAction } = useContext(ToastViewContext)
    if (!toasts.length) return null
    return <div className={`toast-stack ${panel ? 'toast-stack-panel' : 'toast-stack-global'}`} aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => <div key={toast.id} className="dashboard-toast">
            <span>{toast.message}</span>
            {toast.action && <button type="button" onClick={() => void runAction(toast)}>{toast.action.label}</button>}
        </div>)}
    </div>
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([])
    const nextId = useRef(0)
    const running = useRef(new Set<number>())
    const showToast = useCallback((message: string, action?: ToastAction) => {
        const id = nextId.current++
        setToasts((prev) => [...prev, { id, message, action }])
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), action ? 12000 : 3000)
    }, [])
    const runAction = async (toast: ToastItem) => {
        if (running.current.has(toast.id)) return
        running.current.add(toast.id)
        try {
            await toast.action?.run()
            setToasts((items) => items.filter((item) => item.id !== toast.id))
        } catch { showToast('Could not undo. Please try again.') }
        finally { running.current.delete(toast.id) }
    }
    return <ToastContext.Provider value={showToast}>
        <ToastViewContext.Provider value={{ toasts, runAction }}>
            {children}
            <ToastViewport />
        </ToastViewContext.Provider>
    </ToastContext.Provider>
}
