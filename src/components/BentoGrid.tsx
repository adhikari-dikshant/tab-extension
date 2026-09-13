import { NotePencilIcon } from '@phosphor-icons/react/dist/csr/NotePencil'
import { Children, type ReactNode } from 'react'
import { ChecksIcon as CheckCheck } from '@phosphor-icons/react/dist/csr/Checks'
import { CloudSunIcon as CloudSun } from '@phosphor-icons/react/dist/csr/CloudSun'
import { CompassIcon as Compass } from '@phosphor-icons/react/dist/csr/Compass'
import { SquaresFourIcon as LayoutGrid } from '@phosphor-icons/react/dist/csr/SquaresFour'
import { TimerIcon as Timer } from '@phosphor-icons/react/dist/csr/Timer'
import type { Icon as IconComponent } from '@phosphor-icons/react/lib'

const icons: Record<string, IconComponent> = { Notes: NotePencilIcon, Shortcuts: LayoutGrid, 'To-do': CheckCheck, Weather: CloudSun, 'Most visited': Compass, 'Screen time': Timer }

export function BentoGrid({ children }: { children: ReactNode }) {
    return <div className="bento-grid" data-count={Children.toArray(children).length}>{children}</div>
}

export function BentoCard({ title, children, className = '', action }: {
    title: string
    children?: ReactNode
    className?: string
    action?: ReactNode
}) {
    const Icon = icons[title] || LayoutGrid
    return (
        <section className={`bento-card ${className}`} aria-label={title}>
            <header className="card-heading"><h2><span className="card-icon"><Icon size={16} /></span>{title}</h2>{action}</header>
            <div className="card-body themed-scrollbar">{children}</div>
        </section>
    )
}
