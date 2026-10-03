import type { BENTO_WIDGET_IDS } from './storage'

export type CardId = (typeof BENTO_WIDGET_IDS)[number]

/** A card's placement in the bento grid, as CSS grid line numbers. */
export interface Placement {
    column: number
    columnSpan: number
    row: number
    rowSpan: number
}

export interface GridLayout {
    columns: number
    rows: number
    /** Row heights as `grid-template-rows`, so a short card (screen time) gets a short row. */
    rowSizes: string
    placements: Record<string, Placement>
}

/**
 * Lays out the dashboard with up to two "featured" cards given double height, and everything else
 * filling the remaining cells.
 *
 * Replaces the previous nth-child CSS, which positioned cards by their index rather than by what
 * they were — so the tall slot belonged to whichever card happened to sort into it. Driving
 * placement from here instead means "notes and to-do are the big ones" is a statement about cards,
 * survives reordering, and can be tested without a browser.
 *
 * The shape, with two featured cards and six total:
 *
 *     ┌─────────┬─────────┬─────────┐
 *     │         │         │  card   │  row 1
 *     │ FEATURE │ FEATURE ├─────────┤
 *     │         │         │  card   │  row 2
 *     ├─────────┼─────────┴─────────┤
 *     │  card   │       card        │  row 3 (short)
 *     └─────────┴───────────────────┘
 */
export function computeLayout(order: CardId[], featured: CardId[]): GridLayout {
    const cards = order.filter((id, index) => order.indexOf(id) === index)
    const tall = featured.filter((id) => cards.includes(id)).slice(0, 2)
    const rest = cards.filter((id) => !tall.includes(id))

    // Below five cards there is nothing to emphasise against: a single row of equal cards reads
    // better than one tall card beside a gap.
    if (cards.length < 5 || tall.length < 2) {
        const columns = Math.min(cards.length, 3) || 1
        const rows = Math.max(1, Math.ceil(cards.length / columns))
        const placements: Record<string, Placement> = {}
        cards.forEach((id, index) => {
            placements[id] = {
                column: (index % columns) + 1,
                columnSpan: 1,
                row: Math.floor(index / columns) + 1,
                rowSpan: 1,
            }
        })
        return { columns, rows, rowSizes: `repeat(${rows}, minmax(0, 1fr))`, placements }
    }

    const placements: Record<string, Placement> = {}
    // The two tall cards take columns 1 and 2 across the first two rows.
    tall.forEach((id, index) => {
        placements[id] = { column: index + 1, columnSpan: 1, row: 1, rowSpan: 2 }
    })

    // Column 3 stacks the next two cards beside them, then the bottom row takes the remainder.
    const sidebar = rest.slice(0, 2)
    const bottom = rest.slice(2)
    sidebar.forEach((id, index) => {
        placements[id] = { column: 3, columnSpan: 1, row: index + 1, rowSpan: 1 }
    })

    const hasBottom = bottom.length > 0
    if (hasBottom) {
        // Spread the bottom row across all three columns, giving the last card any slack.
        let column = 1
        bottom.forEach((id, index) => {
            const remaining = bottom.length - index - 1
            const span = index === bottom.length - 1 ? 4 - column : Math.max(1, Math.floor((4 - column - remaining)))
            placements[id] = { column, columnSpan: Math.max(1, span), row: 3, rowSpan: 1 }
            column += Math.max(1, span)
        })
    }

    const rows = hasBottom ? 3 : 2
    return {
        columns: 3,
        rows,
        // The bottom row is deliberately shorter: it holds the compact cards, and the tall pair
        // should keep the majority of the height.
        rowSizes: hasBottom ? 'minmax(0, 1fr) minmax(0, 1fr) minmax(130px, 0.72fr)' : 'repeat(2, minmax(0, 1fr))',
        placements,
    }
}

/** `grid-area` shorthand for a placement: row / column / row-end / column-end. */
export function gridArea(placement: Placement): string {
    return `${placement.row} / ${placement.column} / ${placement.row + placement.rowSpan} / ${placement.column + placement.columnSpan}`
}
