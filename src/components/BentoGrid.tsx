import type { ReactNode } from 'react'

export function BentoGrid({ children }: { children: ReactNode }) {
    return (
        <div className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {children}
        </div>
    )
}

export function BentoCard({
    title,
    children,
    className = '',
}: {
    title: string
    children?: ReactNode
    className?: string
}) {
    return (
        <div
            className={`bento-card rounded-2xl border border-black/10 p-4 dark:border-white/10 ${className}`}
        >
            <h2 className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {title}
            </h2>
            {children}
        </div>
    )
}
