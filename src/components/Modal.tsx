import * as Dialog from '@radix-ui/react-dialog'
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
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
                <Dialog.Content className="themed-scrollbar fixed left-1/2 top-1/2 z-40 max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 text-neutral-900 shadow-2xl outline-none dark:bg-neutral-900 dark:text-neutral-100">
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <Dialog.Title className="text-lg font-medium">{title}</Dialog.Title>
                        {headerActions}
                    </div>
                    {children}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
