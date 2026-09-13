import { createContext, useContext } from 'react'

export interface ToastAction { label: string; run: () => void | Promise<void> }
export const ToastContext = createContext<((message: string, action?: ToastAction) => void) | null>(null)

export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be used within a ToastProvider')
    return ctx
}

export interface ToastItem { id: number; message: string; action?: ToastAction }
export const ToastViewContext = createContext<{ toasts: ToastItem[]; runAction: (toast: ToastItem) => Promise<void> }>({ toasts: [], runAction: async () => {} })
