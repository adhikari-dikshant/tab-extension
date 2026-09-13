import { useState, type FormEvent } from 'react'
import { Pagination } from '../Pagination'
import { BentoCard } from '../BentoGrid'
import { CardEmpty, CardSkeleton } from '../CardState'
import { Offcanvas } from '../Offcanvas'
import { ChecksIcon } from '@phosphor-icons/react/dist/csr/Checks'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { PushPinIcon } from '@phosphor-icons/react/dist/csr/PushPin'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/csr/CalendarBlank'
import { TimerIcon } from '@phosphor-icons/react/dist/csr/Timer'
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash'
import { useStorageValue } from '../../lib/useStorageValue'
import { DEFAULT_SETTINGS, type Todo } from '../../lib/storage'
import { changeStored, completeTodo, localDate, startFocus } from '../../lib/productivity'
import { useUndoDelete } from '../../lib/useUndoDelete'
import { useToast } from '../../lib/useToast'

export default function TodoCard() {
    const [todos, , loading] = useStorageValue('todos', [])
    const [settings] = useStorageValue('settings', DEFAULT_SETTINGS)
    const [text, setText] = useState('')
    const [page, setPage] = useState(0)
    const [filter, setFilter] = useState<'all' | 'today' | 'done'>('all')
    const [open, setOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [draft, setDraft] = useState('')
    const [dueDate, setDueDate] = useState('')
    const [repeat, setRepeat] = useState<NonNullable<Todo['repeat']>>('none')
    const remove = useUndoDelete()
    const toast = useToast()
    const today = localDate()
    const visible = todos.filter((todo) => filter === 'all' || (filter === 'done' ? todo.done : !todo.done && !!todo.dueDate && todo.dueDate <= today))
    const sorted = [...visible].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.createdAt - b.createdAt)
    const pageCount = Math.max(1, Math.ceil(sorted.length / 5))
    const currentPage = Math.min(page, pageCount - 1)
    const doneCount = todos.filter((todo) => todo.done).length
    const add = async (taskText: string, date?: string, recurrence: Todo['repeat'] = 'none') => {
        const todo: Todo = { id: crypto.randomUUID(), text: taskText.trim(), done: false, pinned: false, createdAt: Date.now(), dueDate: date || (recurrence !== 'none' ? today : undefined), repeat: recurrence }
        await changeStored('todos', [], (items) => [...items, todo])
        setText(''); setFilter('all'); setPage(0)
    }
    const addTodo = async (e: FormEvent) => {
        e.preventDefault()
        if (!text.trim()) return
        try { await add(text) } catch { toast('Could not save this task. Please try again.') }
    }
    const toggleDone = async (id: string) => {
        let previous: Todo | undefined
        await changeStored('todos', [], (items) => items.map((todo) => {
            if (todo.id !== id) return todo
            previous = todo
            return completeTodo(todo)
        }))
        if (previous?.repeat && previous.repeat !== 'none' && !previous.done) {
            toast('Task completed. Next occurrence scheduled.', { label: 'Undo', run: async () => { await changeStored('todos', [], (items) => items.map((todo) => todo.id === id && previous ? previous : todo)) } })
        }
    }
    const edit = (todo?: Todo) => {
        setEditingId(todo?.id || null); setDraft(todo?.text || text); setDueDate(todo?.dueDate || ''); setRepeat(todo?.repeat || 'none'); setOpen(true)
    }
    const save = async (event: FormEvent) => {
        event.preventDefault()
        event.stopPropagation()
        if (!draft.trim()) return
        try {
            if (editingId) await changeStored('todos', [], (items) => items.map((todo) => todo.id === editingId ? { ...todo, text: draft.trim(), dueDate: dueDate || (repeat !== 'none' ? today : undefined), repeat } : todo))
            else await add(draft, dueDate, repeat)
            setOpen(false)
        } catch { toast('Could not save this task. Please try again.') }
    }
    const focus = async (todo: Todo) => {
        try { await startFocus(25, todo); window.dispatchEvent(new Event('dashboard:focus')) }
        catch { toast('Could not start focus. Please try again.') }
    }
    return <BentoCard title="To-do" className="todo-card" action={<span className="count-badge">{todos.length - doneCount} left</span>}>
        {loading ? <CardSkeleton /> : <div className="todo-content">
            <form onSubmit={(e) => void addTodo(e)} className="todo-form">
                <input value={text} onChange={(e) => setText(e.target.value)} aria-label="New task" placeholder="What needs to get done?" className="min-w-0 flex-1 bg-transparent px-2 py-1" />
                <Offcanvas title={editingId ? 'Edit task' : 'Plan a task'} description="Choose a date or a repeating schedule. Due tasks appear in Today." icon={CalendarBlankIcon} open={open} onOpenChange={(next) => { if (next) edit(); else setOpen(false) }}
                    trigger={<button type="button" className="icon-control" aria-label="Plan a task"><CalendarBlankIcon size={17} /></button>}>
                    <form className="productivity-form" onSubmit={(e) => void save(e)}>
                        <label>Task<input aria-label="Task description" required value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)} /></label>
                        <label>Due date<input type="date" aria-label="Task due date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
                        <div className="productivity-toolbar"><button type="button" className="productivity-button mt-5" onClick={() => setDueDate(today)}>Today</button><button type="button" className="productivity-button mt-5" onClick={() => { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); setDueDate(localDate(tomorrow)) }}>Tomorrow</button><button type="button" className="productivity-button mt-5" onClick={() => setDueDate('')}>No date</button></div>
                        <label>Repeat<select aria-label="Task repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as NonNullable<Todo['repeat']>)}><option value="none">Does not repeat</option><option value="daily">Every day</option><option value="weekly">Every week</option></select></label>
                        <p className="productivity-muted">Repeating tasks move to their next date when completed. Optional desktop reminders arrive at 9 AM; enable them in Settings.</p>
                        <button className="productivity-button mt-5 primary" type="submit">{editingId ? 'Save task' : 'Add planned task'}</button>
                    </form>
                </Offcanvas>
                <button type="submit" className="add-task-button" aria-label="Add task"><PlusIcon size={18} /></button>
            </form>
            <div className="productivity-tabs task-filters" aria-label="Filter tasks">{(['all', 'today', 'done'] as const).map((value) => <button key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(0) }}>{value === 'all' ? 'All' : value === 'today' ? 'Today' : 'Completed'}</button>)}</div>
            {!sorted.length ? <CardEmpty><span className="empty-illustration"><ChecksIcon size={28} /></span><strong>{filter === 'today' ? 'Nothing due today.' : filter === 'done' ? 'Your finished tasks will appear here.' : 'A little focus goes a long way.'}</strong>{filter === 'all' && <p>Add a task to get started.</p>}</CardEmpty> : <ul className="todo-list">
                {sorted.slice(currentPage * 5, currentPage * 5 + 5).map((todo) => <li key={todo.id} className="todo-row group flex items-center gap-2">
                    <input type="checkbox" aria-label={`Complete ${todo.text}`} checked={todo.done} onChange={() => void toggleDone(todo.id)} className="shrink-0" />
                    <span className="task-text"><span className={todo.done ? 'line-through opacity-60' : ''}>{todo.text}</span>{todo.dueDate && <small className={!todo.done && todo.dueDate < today ? 'task-overdue' : ''}>{todo.dueDate === today ? 'Today' : todo.dueDate}{todo.repeat && todo.repeat !== 'none' ? ` · ${todo.repeat}` : ''}</small>}</span>
                    {settings.focusEnabled && !todo.done && <button className="task-action icon-control" aria-label={`Focus on ${todo.text}`} onClick={() => void focus(todo)}><TimerIcon size={14} /></button>}
                    <button className="task-action icon-control" aria-label={`Edit ${todo.text}`} onClick={() => edit(todo)}><PencilSimpleIcon size={14} /></button>
                    <button className="icon-control" aria-label={todo.pinned ? `Unpin ${todo.text}` : `Pin ${todo.text}`} aria-pressed={todo.pinned} onClick={() => void changeStored('todos', [], (items) => items.map((item) => item.id === todo.id ? { ...item, pinned: !item.pinned } : item))}><PushPinIcon size={14} weight={todo.pinned ? 'fill' : 'regular'} /></button>
                    <button className="task-action icon-control" aria-label={`Delete ${todo.text}`} onClick={() => void remove('todos', todo.id, 'Task')}><TrashIcon size={14} /></button>
                </li>)}
            </ul>}
            <div className="todo-progress"><div><span>{doneCount} of {todos.length} completed</span><span>{todos.length ? Math.round(doneCount / todos.length * 100) : 0}%</span></div><progress aria-label="Task completion" value={doneCount} max={Math.max(1, todos.length)} /></div>
            <Pagination page={currentPage} count={pageCount} onChange={setPage} label="tasks" />
        </div>}
    </BentoCard>
}
