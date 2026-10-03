import { useEffect, useState, type CSSProperties } from 'react'
import { DotsSixVerticalIcon } from '@phosphor-icons/react/dist/csr/DotsSixVertical'
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowLeft'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { BENTO_WIDGET_IDS, DEFAULT_SETTINGS, WIDGET_LABELS } from '../lib/storage'
import { computeLayout, gridArea, type CardId } from '../lib/layout'
import { useStorageValue } from '../lib/useStorageValue'
import ShortcutsCard from './cards/ShortcutsCard'
import TodoCard from './cards/TodoCard'
import ScreenTimeCard from './cards/ScreenTimeCard'
import MostVisitedCard from './cards/MostVisitedCard'
import NotesCard from './cards/NotesCard'

const cards = { shortcuts: ShortcutsCard, todo: TodoCard, screentime: ScreenTimeCard, mostVisited: MostVisitedCard, notes: NotesCard }

/** How many cards may be given double height at once. Two reads as a deliberate pair; three leaves
 * no room for the compact cards to sit beside them. */
const MAX_FEATURED = 2

export default function DashboardGrid() {
    const [settings, setSettings] = useStorageValue('settings', DEFAULT_SETTINGS)
    const [editing, setEditing] = useState(false)
    const [dragId, setDragId] = useState<CardId | null>(null)

    // Card placement comes from settings.cardOrder (migrations keep it populated); appending the
    // defaults is a safety net so a card can never go missing if that list is short or stale.
    const order = [...new Set([...settings.cardOrder, ...DEFAULT_SETTINGS.cardOrder])].filter((id) => BENTO_WIDGET_IDS.includes(id))
    const visible = order.filter((id) => settings.widgetsEnabled.includes(id))
    const featured = settings.featuredCards.filter((id) => visible.includes(id))
    const layout = computeLayout(visible, featured)

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

    /** Featured is a set of at most two: picking a third drops the one chosen longest ago. */
    const toggleFeatured = (id: CardId) => {
        const current = settings.featuredCards
        const next = current.includes(id)
            ? current.filter((card) => card !== id)
            : [...current, id].slice(-MAX_FEATURED)
        setSettings({ ...settings, featuredCards: next })
    }

    const gridStyle = {
        gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
        gridTemplateRows: layout.rowSizes,
    } as CSSProperties

    return <>
        {editing && <div className="layout-toolbar">
            <span>Drag cards to reorder</span>
            <span className="layout-hint">Tap a card's ⌃ to give it more height ({featured.length}/{MAX_FEATURED})</span>
            <button onClick={() => setSettings({ ...settings, cardOrder: DEFAULT_SETTINGS.cardOrder, featuredCards: DEFAULT_SETTINGS.featuredCards })}>Reset layout</button>
            <button className="productivity-button mt-5" onClick={() => setEditing(false)}>Done editing</button>
        </div>}
        <div className="bento-grid dashboard-grid" style={gridStyle} data-count={visible.length} data-editing={editing}>
            {visible.map((id, index) => {
                const Card = cards[id]
                const placement = layout.placements[id]
                const isFeatured = featured.includes(id)
                return <div
                    key={id}
                    className="dashboard-card-slot"
                    data-card={id}
                    data-featured={isFeatured || undefined}
                    style={placement ? { gridArea: gridArea(placement) } : undefined}
                    onDragOver={(event) => { if (editing && dragId) event.preventDefault() }}
                    onDrop={(event) => {
                        if (!editing || !dragId) return
                        event.preventDefault(); event.stopPropagation(); move(dragId, id); setDragId(null)
                    }}
                >
                    {editing && <div className="layout-card-controls">
                        <button draggable onDragStart={(event) => { setDragId(id); event.dataTransfer.setData('text/plain', id); event.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => setDragId(null)} aria-label={`Drag ${WIDGET_LABELS[id]}`}><DotsSixVerticalIcon size={18} /></button>
                        <span>{WIDGET_LABELS[id]}</span>
                        <button
                            className="layout-feature-toggle"
                            aria-pressed={isFeatured}
                            aria-label={`${isFeatured ? 'Shrink' : 'Enlarge'} ${WIDGET_LABELS[id]}`}
                            onClick={() => toggleFeatured(id)}
                        >⌃</button>
                        <button disabled={!index} aria-label={`Move ${WIDGET_LABELS[id]} earlier`} onClick={() => move(id, visible[index - 1])}><ArrowLeftIcon size={16} /></button>
                        <button disabled={index === visible.length - 1} aria-label={`Move ${WIDGET_LABELS[id]} later`} onClick={() => move(id, visible[index + 1])}><ArrowRightIcon size={16} /></button>
                    </div>}
                    <Card />
                </div>
            })}
        </div>
    </>
}
