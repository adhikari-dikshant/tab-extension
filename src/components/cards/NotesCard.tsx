import { NotePencilIcon } from '@phosphor-icons/react/dist/csr/NotePencil'
import { PushPinIcon } from '@phosphor-icons/react/dist/csr/PushPin'
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/csr/ArrowUpRight'
import { BentoCard } from '../BentoGrid'
import { CardEmpty, CardSkeleton } from '../CardState'
import NotesButton from '../NotesButton'
import { useStorageValue } from '../../lib/useStorageValue'

export default function NotesCard() {
    const [notes, , loading] = useStorageValue('notes', [])
    const sorted = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
    return <BentoCard title="Notes" className="notes-card" action={<NotesButton trigger={<button className="icon-control" aria-label="Manage notes" title="Manage notes"><ArrowUpRightIcon size={16} /></button>} />}>
        {loading ? <CardSkeleton /> : sorted.length ? <ul className="notes-list">
            {sorted.map((note) => <li key={note.id}>
                <NotesButton noteId={note.id} trigger={<button className="note-card-preview" aria-label={`Open note ${note.title || 'Untitled note'}`}>
                    <span className="note-card-title">{note.pinned && <PushPinIcon size={13} weight="fill" />}<strong>{note.title || 'Untitled note'}</strong></span>
                    <span className="note-card-body">{note.body || 'Add something to this note…'}</span>
                </button>} />
            </li>)}
        </ul> : <CardEmpty><span className="empty-illustration"><NotePencilIcon size={25} /></span><strong>A little room for your thoughts.</strong><NotesButton trigger={<button className="productivity-button mt-5">Open notes</button>} /></CardEmpty>}
    </BentoCard>
}
