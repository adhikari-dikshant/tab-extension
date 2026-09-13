import { useRef, useState, type ReactElement } from 'react'
import { NotePencilIcon } from '@phosphor-icons/react/dist/csr/NotePencil'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { PushPinIcon } from '@phosphor-icons/react/dist/csr/PushPin'
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash'
import { Offcanvas } from './Offcanvas'
import { useStorageValue } from '../lib/useStorageValue'
import { changeStored } from '../lib/productivity'
import { useUndoDelete } from '../lib/useUndoDelete'
import { useToast } from '../lib/useToast'
import type { Note } from '../lib/storage'

function NoteEditor({ note }: { note: Note }) {
    const [title, setTitle] = useState(note.title)
    const [body, setBody] = useState(note.body)
    const [status, setStatus] = useState('Saved on this device')
    const version = useRef(0)
    const [activeField, setActiveField] = useState<'title' | 'body' | null>(null)
    const edit = (patch: Partial<Note>) => {
        const revision = ++version.current
        setStatus('Saving…')
        // Queue immediately: closing or deleting the note cannot overtake the last keystroke.
        void changeStored('notes', [], (notes) => notes.map((item) => item.id === note.id ? { ...item, ...patch, updatedAt: Date.now() } : item))
            .then(() => { if (version.current === revision) setStatus('Saved on this device') })
            .catch(() => { if (version.current === revision) setStatus('Could not save. Keep this note open and try editing again.') })
    }
    return <div className="note-editor">
        <input aria-label="Note title" maxLength={120} placeholder="Untitled note" value={activeField === 'title' ? title : note.title} onFocus={() => { setTitle(note.title); setActiveField('title') }} onBlur={() => setActiveField(null)} onChange={(e) => { setTitle(e.target.value); edit({ title: e.target.value }) }} />
        <textarea aria-label="Note text" placeholder="Capture a thought…" value={activeField === 'body' ? body : note.body} onFocus={() => { setBody(note.body); setActiveField('body') }} onBlur={() => setActiveField(null)} onChange={(e) => { setBody(e.target.value); edit({ body: e.target.value }) }} />
        <span className="productivity-muted" role="status">{status}</span>
    </div>
}

export default function NotesButton({ trigger, noteId }: { trigger?: ReactElement; noteId?: string }) {
    const [notes] = useStorageValue('notes', [])
    const [open, setOpen] = useState(false)
    const [selected, setSelected] = useState<string | null>(null)
    const remove = useUndoDelete()
    const toast = useToast()
    const note = notes.find((item) => item.id === selected) || notes.find((item) => item.pinned) || notes[0]
    const add = async () => {
        const item: Note = { id: crypto.randomUUID(), title: '', body: '', pinned: false, updatedAt: Date.now() }
        try { await changeStored('notes', [], (items) => [...items, item]); setSelected(item.id) }
        catch { toast('Could not create a note. Please try again.') }
    }
    return <Offcanvas title="Quick notes" description="A place for ideas, reminders, and rough drafts. Saved automatically." icon={NotePencilIcon} open={open} onOpenChange={(next) => { if (next && noteId) setSelected(noteId); setOpen(next) }}
        trigger={trigger || <button aria-label="Quick notes"><NotePencilIcon size={22} /></button>}>
        <div className="productivity-toolbar"><span className="productivity-muted">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span><button className="productivity-button mt-5" onClick={() => void add()}><PlusIcon size={15} />New note</button></div>
        {notes.length > 0 && <div className="note-tabs" aria-label="Choose a note">{notes.map((item) => <button key={item.id} aria-pressed={note?.id === item.id} onClick={() => setSelected(item.id)}>{item.pinned && <PushPinIcon size={13} />}{item.title || 'Untitled note'}</button>)}</div>}
        {note ? <>
            <div className="productivity-toolbar"><button className="productivity-button mt-5" aria-pressed={note.pinned} onClick={() => void changeStored('notes', [], (items) => items.map((item) => ({ ...item, pinned: item.id === note.id ? !note.pinned : false })))}><PushPinIcon size={15} />{note.pinned ? 'Unpin note' : 'Pin in Notes'}</button><button className="icon-control" aria-label="Delete note" onClick={() => void remove('notes', note.id, 'Note')}><TrashIcon size={17} /></button></div>
            <NoteEditor key={note.id} note={note} />
        </> : <div className="offcanvas-empty">Your next idea belongs here. Create a note to get started.</div>}
    </Offcanvas>
}
