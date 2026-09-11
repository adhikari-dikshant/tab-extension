import { createContext, useContext } from 'react'

export const ToastContext = createContext<((message: string) => void) | null>(null)

export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be used within a ToastProvider')
    return ctx
}
