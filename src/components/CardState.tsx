import type { ReactNode } from 'react'

export function CardSkeleton() {
    return (
        <div className="animate-pulse space-y-2">
            <div className="h-4 w-3/4 rounded bg-black/10 dark:bg-white/10" />
            <div className="h-4 w-1/2 rounded bg-black/10 dark:bg-white/10" />
        </div>
    )
}

export function CardEmpty({ children }: { children: ReactNode }) {
    return (
        <div className="card-empty">
            {children}
        </div>
    )
}

export function CardError({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
            {children}
        </div>
    )
}
