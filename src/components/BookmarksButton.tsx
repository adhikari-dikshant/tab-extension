import { useState } from 'react'
import { BookmarkSimpleIcon as Bookmark } from '@phosphor-icons/react/dist/csr/BookmarkSimple'
import { Modal } from './Modal'
import BookmarksPanel from './BookmarksPanel'

export default function BookmarksButton() {
    const [open, setOpen] = useState(false)

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Bookmarks"
                className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10"
            >
                <Bookmark className="h-5 w-5" />
            </button>
            <Modal open={open} onClose={() => setOpen(false)} title="Bookmarks">
                <BookmarksPanel />
            </Modal>
        </>
    )
}
