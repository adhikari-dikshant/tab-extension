import { ToastViewport } from './Toast'
import * as Dialog from '@radix-ui/react-dialog'
import { XIcon as X } from '@phosphor-icons/react/dist/csr/X'
import type { Icon as IconComponent } from '@phosphor-icons/react/lib'
import type { ReactElement, ReactNode } from 'react'

export function Offcanvas({ title, description, icon: Icon, trigger, children, open, onOpenChange }: {
    title: string
    description: string
    icon: IconComponent
    trigger: ReactElement
    children: ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}) {
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="offcanvas-backdrop" />
                <Dialog.Content className="offcanvas-panel">
                    <header className="offcanvas-header">
                        <span className="offcanvas-icon"><Icon size={24} /></span>
                        <Dialog.Close className="offcanvas-close" aria-label={`Close ${title.toLowerCase()}`}><X size={20} /></Dialog.Close>
                        <Dialog.Title>{title}</Dialog.Title>
                        <Dialog.Description>{description}</Dialog.Description>
                    </header>
                    <div className="offcanvas-body themed-scrollbar">{children}</div>
                    <ToastViewport panel />
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
