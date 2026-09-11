import type { ReactNode } from 'react'

export function SettingRow({
    label,
    description,
    children,
    dimmed = false,
}: {
    label: string
    description?: string
    children: ReactNode
    dimmed?: boolean
}) {
    return (
        <div className={`flex items-center justify-between gap-3 py-2.5 ${dimmed ? 'opacity-50' : ''}`}>
            <div className="min-w-0">
                <p className="font-medium">{label}</p>
                {description && <p className="truncate text-xs text-neutral-400">{description}</p>}
            </div>
            {children}
        </div>
    )
}
