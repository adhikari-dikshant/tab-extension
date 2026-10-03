import test from 'node:test'
import assert from 'node:assert/strict'
import { computeLayout, gridArea } from '../src/lib/layout.ts'
import { DEFAULT_SETTINGS } from '../src/lib/storage.ts'

const ALL = DEFAULT_SETTINGS.cardOrder
const cells = (layout) => Object.values(layout.placements)
    .flatMap((p) => Array.from({ length: p.rowSpan }, (_, r) => Array.from({ length: p.columnSpan }, (_, c) => `${p.row + r},${p.column + c}`)).flat())

function assertNoOverlap(layout) {
    const seen = cells(layout)
    assert.equal(new Set(seen).size, seen.length, `cards overlap: ${seen.join(' ')}`)
    for (const p of Object.values(layout.placements)) {
        assert.ok(p.column >= 1 && p.column + p.columnSpan - 1 <= layout.columns, 'a card runs past the last column')
        assert.ok(p.row >= 1 && p.row + p.rowSpan - 1 <= layout.rows, 'a card runs past the last row')
    }
}

test('the default layout gives to-do and notes double height', () => {
    const layout = computeLayout(ALL, DEFAULT_SETTINGS.featuredCards)
    assert.equal(layout.placements.todo.rowSpan, 2)
    assert.equal(layout.placements.notes.rowSpan, 2)
    for (const id of ALL.filter((c) => !['todo', 'notes'].includes(c))) {
        assert.equal(layout.placements[id].rowSpan, 1, `${id} should not be tall`)
    }
    assertNoOverlap(layout)
})

test('every card is placed exactly once, with no gaps or overlaps', () => {
    const layout = computeLayout(ALL, ['todo', 'notes'])
    assert.deepEqual(Object.keys(layout.placements).sort(), [...ALL].sort())
    assertNoOverlap(layout)
    // Six cards across a 3x3 grid where the tall pair takes four cells: the rest must tile the other five.
    assert.equal(cells(layout).length, 9, 'the grid is filled, leaving no hole beside the tall cards')
})

test('the featured pair follows the cards, not their position in the order', () => {
    const reordered = ['weather', 'screentime', 'shortcuts', 'mostVisited', 'todo', 'notes']
    const layout = computeLayout(reordered, ['todo', 'notes'])
    assert.equal(layout.placements.todo.rowSpan, 2, 'reordering does not move the emphasis')
    assert.equal(layout.placements.notes.rowSpan, 2)
    assertNoOverlap(layout)
})

test('any two cards can be the featured pair', () => {
    for (const pair of [['screentime', 'shortcuts'], ['screentime', 'mostVisited'], ['notes', 'shortcuts']]) {
        const layout = computeLayout(ALL, pair)
        for (const id of pair) assert.equal(layout.placements[id].rowSpan, 2, `${id} should be tall`)
        assertNoOverlap(layout)
    }
})

test('a featured card that is switched off is ignored rather than leaving a hole', () => {
    const visible = ['weather', 'screentime', 'shortcuts', 'mostVisited', 'notes']
    const layout = computeLayout(visible, ['todo', 'notes'])
    assert.ok(!('todo' in layout.placements))
    assert.deepEqual(Object.keys(layout.placements).sort(), [...visible].sort())
    assertNoOverlap(layout)
})

test('small card counts fall back to an even grid instead of a lopsided one', () => {
    for (let count = 1; count <= 4; count++) {
        const visible = ALL.slice(0, count)
        const layout = computeLayout(visible, ['todo', 'notes'])
        assert.equal(Object.keys(layout.placements).length, count)
        for (const p of Object.values(layout.placements)) {
            assert.equal(p.rowSpan, 1, `with ${count} cards nothing should be tall`)
            assert.equal(p.columnSpan, 1)
        }
        assertNoOverlap(layout)
    }
})

test('fewer than two featured cards also falls back to an even grid', () => {
    const layout = computeLayout(ALL, ['todo'])
    assert.equal(layout.placements.todo.rowSpan, 1, 'one emphasised card is not the two-tall shape')
    assertNoOverlap(layout)
    assertNoOverlap(computeLayout(ALL, []))
})

test('duplicate ids in the order are collapsed', () => {
    const layout = computeLayout(['todo', 'todo', 'notes', 'weather', 'screentime', 'shortcuts', 'mostVisited'], ['todo', 'notes'])
    assert.equal(Object.keys(layout.placements).length, 6)
    assertNoOverlap(layout)
})

test('grid-area is emitted as row/column/row-end/column-end', () => {
    assert.equal(gridArea({ row: 1, column: 2, rowSpan: 2, columnSpan: 1 }), '1 / 2 / 3 / 3')
    assert.equal(gridArea({ row: 3, column: 1, rowSpan: 1, columnSpan: 3 }), '3 / 1 / 4 / 4')
})

test('five cards still give the featured pair their height, with no hole left by the retired card', () => {
    // Weather moved to the welcome strip, so the default grid is five cards, not six.
    assert.equal(DEFAULT_SETTINGS.cardOrder.length, 5)
    const layout = computeLayout(DEFAULT_SETTINGS.cardOrder, DEFAULT_SETTINGS.featuredCards)
    assert.equal(layout.placements.todo.rowSpan, 2)
    assert.equal(layout.placements.notes.rowSpan, 2)
    assertNoOverlap(layout)
    assert.equal(cells(layout).length, 9, 'the bottom card stretches to fill the row rather than leaving a gap')
})
