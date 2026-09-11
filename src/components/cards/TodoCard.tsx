import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { BentoCard } from '../BentoGrid'
import { CardEmpty, CardSkeleton } from '../CardState'
import { Pencil, Pin } from 'lucide-react'
import { useStorageValue } from '../../lib/useStorageValue'

export default function TodoCard() {
    const [todos, setTodos, loading] = useStorageValue('todos', [])
    const [text, setText] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editText, setEditText] = useState('')

    const sorted = [...todos].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.createdAt - b.createdAt)
    const doneCount = todos.filter((t) => t.done).length

    const addTodo = (e: FormEvent) => {
        e.preventDefault()
        const trimmed = text.trim()
        if (!trimmed) return
        setTodos([...todos, { id: crypto.randomUUID(), text: trimmed, done: false, pinned: false, createdAt: Date.now() }])
        setText('')
    }

    const toggleDone = (id: string) => {
        setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
    }

    const togglePin = (id: string) => {
        setTodos(todos.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)))
    }

    const remove = (id: string) => {
        setTodos(todos.filter((t) => t.id !== id))
    }

    const startEdit = (id: string, currentText: string) => {
        setEditingId(id)
        setEditText(currentText)
    }

    const commitEdit = () => {
        const trimmed = editText.trim()
        if (trimmed && editingId) {
            setTodos(todos.map((t) => (t.id === editingId ? { ...t, text: trimmed } : t)))
        }
        setEditingId(null)
    }

    const onEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') commitEdit()
        else if (e.key === 'Escape') setEditingId(null)
    }

    return (
        <BentoCard
            title={todos.length > 0 ? `To-do — ${doneCount} of ${todos.length} done` : 'To-do'}
        >
            {loading ? (
                <CardSkeleton />
            ) : (
                <div className="space-y-2">
                    <form onSubmit={addTodo} className="flex gap-2">
                        <input
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Add a task…"
                            className="min-w-0 flex-1 rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
                        />
                        <button type="submit" className="text-sm font-medium">
                            Add
                        </button>
                    </form>

                    {sorted.length === 0 ? (
                        <CardEmpty>Nothing on your list.</CardEmpty>
                    ) : (
                        <ul className="themed-scrollbar max-h-48 space-y-1 overflow-y-auto">
                            {sorted.map((todo) => (
                                <li key={todo.id} className="group flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={todo.done}
                                        onChange={() => toggleDone(todo.id)}
                                        className="shrink-0"
                                    />
                                    {editingId === todo.id ? (
                                        <input
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            onBlur={commitEdit}
                                            onKeyDown={onEditKeyDown}
                                            autoFocus
                                            className="min-w-0 flex-1 rounded border border-black/10 bg-transparent px-1 text-sm outline-none dark:border-white/10"
                                        />
                                    ) : (
                                        <span
                                            className={`min-w-0 flex-1 truncate ${
                                                todo.done ? 'text-neutral-400 line-through' : ''
                                            }`}
                                        >
                                            {todo.text}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => startEdit(todo.id, todo.text)}
                                        aria-label="Edit task"
                                        className="hidden shrink-0 text-neutral-400 group-hover:inline-flex"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => togglePin(todo.id)}
                                        aria-label={todo.pinned ? 'Unpin' : 'Pin'}
                                        className={`shrink-0 ${todo.pinned ? 'text-amber-500' : 'text-neutral-300 dark:text-neutral-600'}`}
                                    >
                                        <Pin className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => remove(todo.id)}
                                        aria-label="Remove"
                                        className="hidden shrink-0 text-neutral-400 group-hover:inline"
                                    >
                                        ×
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </BentoCard>
    )
}
