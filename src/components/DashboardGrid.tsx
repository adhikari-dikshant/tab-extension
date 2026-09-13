import { useEffect, useState, type CSSProperties } from 'react'
import { DotsSixVerticalIcon } from '@phosphor-icons/react/dist/csr/DotsSixVertical'
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowLeft'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { BENTO_WIDGET_IDS, DEFAULT_SETTINGS, WIDGET_LABELS } from '../lib/storage'
import { useStorageValue } from '../lib/useStorageValue'
import ShortcutsCard from './cards/ShortcutsCard'
import TodoCard from './cards/TodoCard'
import WeatherCard from './cards/WeatherCard'
import ScreenTimeCard from './cards/ScreenTimeCard'
import MostVisitedCard from './cards/MostVisitedCard'
import NotesCard from './cards/NotesCard'

type CardId = (typeof BENTO_WIDGET_IDS)[number]
const cards = { shortcuts: ShortcutsCard, todo: TodoCard, weather: WeatherCard, screentime: ScreenTimeCard, mostVisited: MostVisitedCard, notes: NotesCard }

export default function DashboardGrid() {
    const [settings, setSettings] = useStorageValue('settings', DEFAULT_SETTINGS)
    const [editing, setEditing] = useState(false)
    const [dragId, setDragId] = useState<CardId | null>(null)
    // Insert the new card next to Most visited while preserving previously saved ordering.
    const savedOrder = [...settings.cardOrder]
    if (!savedOrder.includes('notes')) {
        const after = savedOrder.indexOf('mostVisited')
        savedOrder.splice(after < 0 ? savedOrder.length : after + 1, 0, 'notes')
    }
    const order = [...new Set([...savedOrder, ...DEFAULT_SETTINGS.cardOrder])].filter((id) => BENTO_WIDGET_IDS.includes(id))
    const visible = order.filter((id) => id === 'notes' ? settings.notesEnabled : settings.widgetsEnabled.includes(id))
    const featured = visible.includes(settings.featuredCard) ? settings.featuredCard : visible[0]
    const featuredColumn = Math.min(visible.indexOf(featured), 2) + 1
    const otherSlots = [1, 2].flatMap((row) => [1, 2, 3].filter((column) => column !== featuredColumn).map((column) => ({ row, column })))
    let slot = 0
    useEffect(() => {
        const edit = () => setEditing(true)
        window.addEventListener('dashboard:layout', edit)
        return () => window.removeEventListener('dashboard:layout', edit)
    }, [])
    const move = (from: CardId, to: CardId) => {
        if (from === to) return
        const next = order.filter((id) => id !== from)
        next.splice(order.indexOf(to), 0, from)
        setSettings({ ...settings, cardOrder: next })
    }
    return <>
        {editing && <div className="layout-toolbar">
            <span>Drag cards to reorder</span>
            <label>More space<select aria-label="Featured card" value={featured || settings.featuredCard} disabled={visible.length < 5} onChange={(e) => setSettings({ ...settings, featuredCard: e.target.value as CardId })}>{visible.map((id) => <option key={id} value={id}>{WIDGET_LABELS[id]}</option>)}</select></label>
            <button onClick={() => setSettings({ ...settings, cardOrder: DEFAULT_SETTINGS.cardOrder, featuredCard: 'todo' })}>Reset layout</button>
            <button className="productivity-button mt-5 mt-5" onClick={() => setEditing(false)}>Done editing</button>
        </div>}
        <div className="bento-grid dashboard-grid" data-count={visible.length} data-editing={editing} data-featured-column={visible.indexOf(featured) % 3 + 1}>
            {visible.map((id, index) => {
                const Card = cards[id]
                const position = id === featured ? { column: featuredColumn, row: '1 / span 2' } : otherSlots[slot++]
                const style = visible.length === 5 ? { '--slot-column': position.column, '--slot-row': position.row } as CSSProperties : undefined
                return <div key={id} className="dashboard-card-slot" data-card={id} style={style} onDragOver={(event) => { if (editing && dragId) event.preventDefault() }} onDrop={(event) => {
                    if (!editing || !dragId) return
                    event.preventDefault(); event.stopPropagation(); move(dragId, id); setDragId(null)
                }}>
                    {editing && <div className="layout-card-controls">
                        <button draggable onDragStart={(event) => { setDragId(id); event.dataTransfer.setData('text/plain', id); event.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => setDragId(null)} aria-label={`Drag ${WIDGET_LABELS[id]}`}><DotsSixVerticalIcon size={18} /></button>
                        <span>{WIDGET_LABELS[id]}</span>
                        <button disabled={!index} aria-label={`Move ${WIDGET_LABELS[id]} earlier`} onClick={() => move(id, visible[index - 1])}><ArrowLeftIcon size={16} /></button>
                        <button disabled={index === visible.length - 1} aria-label={`Move ${WIDGET_LABELS[id]} later`} onClick={() => move(id, visible[index + 1])}><ArrowRightIcon size={16} /></button>
                    </div>}
                    <Card />
                </div>
            })}
        </div>
    </>
}
