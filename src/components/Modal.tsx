import { ToastViewport } from './Toast'
import * as Dialog from '@radix-ui/react-dialog'
import { XIcon as X } from '@phosphor-icons/react/dist/csr/X'
import type { ReactNode } from 'react'

export function Modal({
    open,
    onClose,
    title,
    headerActions,
    children,
}: {
    open: boolean
    onClose: () => void
    title: string
    headerActions?: ReactNode
    children: ReactNode
}) {
    return (
        <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm" />
                <Dialog.Content className="themed-scrollbar fixed left-1/2 top-1/2 z-40 max-h-[85vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 text-neutral-900 shadow-2xl outline-none dark:bg-neutral-900 dark:text-neutral-100">
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <Dialog.Title className="text-lg font-medium">{title}</Dialog.Title>
                        <div className="flex items-center gap-2">{headerActions}<Dialog.Close aria-label="Close dialog" className="modal-close"><X size={18} /></Dialog.Close></div>
                    </div>
                    <Dialog.Description className="sr-only">Manage {title.toLowerCase()} for your dashboard.</Dialog.Description>
                    {children}
                    <ToastViewport panel />
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
