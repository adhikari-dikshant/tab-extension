import test from 'node:test'
import assert from 'node:assert/strict'
import { snapHandleToEdge, clampTimer, resolvePosition, exceededThreshold, DRAG_THRESHOLD_PX } from '../src/lib/overlayPosition.ts'

const VIEW = { width: 1000, height: 800 }
const HANDLE = 80

test('a drop resolves to whichever side edge is the shorter straight path', () => {
    assert.equal(snapHandleToEdge({ x: 100, y: 400 }, VIEW, HANDLE).side, 'left')
    assert.equal(snapHandleToEdge({ x: 900, y: 400 }, VIEW, HANDLE).side, 'right')
    // Just past the midpoint is enough to flip it — there is no dead zone to get stuck in.
    assert.equal(snapHandleToEdge({ x: 499, y: 400 }, VIEW, HANDLE).side, 'left')
    assert.equal(snapHandleToEdge({ x: 501, y: 400 }, VIEW, HANDLE).side, 'right')
    // Dead centre has to go somewhere; it matches the default side.
    assert.equal(snapHandleToEdge({ x: 500, y: 400 }, VIEW, HANDLE).side, 'left')
})

test('dropping in the middle of the page still attaches to an edge', () => {
    const middle = snapHandleToEdge({ x: 420, y: 390 }, VIEW, HANDLE)
    assert.ok(middle.side === 'left' || middle.side === 'right')
    // The height it was dropped at is kept, so the choice of edge is the only thing that moves.
    assert.ok(Math.abs(middle.offsetY - 390 / 800) < 0.001)
})

test('the handle can never hang off the top or bottom', () => {
    const margin = HANDLE / 2 / VIEW.height
    const high = snapHandleToEdge({ x: 10, y: -500 }, VIEW, HANDLE)
    const low = snapHandleToEdge({ x: 10, y: 99999 }, VIEW, HANDLE)
    assert.ok(high.offsetY >= margin - 1e-9, `${high.offsetY} < ${margin}`)
    assert.ok(low.offsetY <= 1 - margin + 1e-9)
    // In pixels: fully on screen at both extremes.
    assert.ok(high.offsetY * VIEW.height - HANDLE / 2 >= -1e-6)
    assert.ok(low.offsetY * VIEW.height + HANDLE / 2 <= VIEW.height + 1e-6)
})

test('a viewport shorter than the handle centres it rather than wedging it against an edge', () => {
    const tiny = { width: 400, height: 40 }
    assert.equal(snapHandleToEdge({ x: 10, y: 0 }, tiny, 200).offsetY, 0.5)
})

test('positions are ratios, so they survive a resize instead of landing off-screen', () => {
    const wide = snapHandleToEdge({ x: 2550, y: 700 }, { width: 2560, height: 1400 }, HANDLE)
    assert.equal(wide.side, 'right')
    // Replayed on a laptop the same ratio is still on screen and still half way down.
    assert.ok(wide.offsetY * 800 > 0 && wide.offsetY * 800 < 800)
    assert.ok(Math.abs(wide.offsetY - 0.5) < 0.01)
})

test('the timer stays fully on screen wherever it is released', () => {
    const size = { width: 160, height: 36 }
    for (const point of [{ x: -200, y: -200 }, { x: 99999, y: 99999 }, { x: 0, y: 0 }, { x: 1000, y: 800 }]) {
        const at = clampTimer(point, VIEW, size)
        assert.ok(at.x * VIEW.width - size.width / 2 >= -1e-6, `left edge: ${at.x}`)
        assert.ok(at.x * VIEW.width + size.width / 2 <= VIEW.width + 1e-6, `right edge: ${at.x}`)
        assert.ok(at.y * VIEW.height - size.height / 2 >= -1e-6)
        assert.ok(at.y * VIEW.height + size.height / 2 <= VIEW.height + 1e-6)
    }
})

test('the timer is left where it is put, unlike the handle', () => {
    const at = clampTimer({ x: 430, y: 365 }, VIEW, { width: 160, height: 36 })
    assert.ok(Math.abs(at.x - 0.43) < 0.001, 'no snapping to an edge or a corner')
    assert.ok(Math.abs(at.y - 365 / 800) < 0.001)
})

test('a shaky click is not a drag', () => {
    const from = { x: 100, y: 100 }
    assert.equal(exceededThreshold(from, { x: 102, y: 101 }), false)
    assert.equal(exceededThreshold(from, { x: 100 + DRAG_THRESHOLD_PX + 1, y: 100 }), true)
    assert.equal(exceededThreshold(from, from), false)
})

test('nonsense coordinates do not produce a NaN position', () => {
    const at = snapHandleToEdge({ x: Number.NaN, y: Number.NaN }, VIEW, HANDLE)
    assert.ok(Number.isFinite(at.offsetY))
    const timer = clampTimer({ x: Number.NaN, y: Number.NaN }, VIEW, { width: 160, height: 36 })
    assert.ok(Number.isFinite(timer.x) && Number.isFinite(timer.y))
})

test('every render path gets a real position, including between sessions', () => {
    // 0.3.0 shipped an idle state that rendered with no left/top. `.timer` is position: fixed, so it
    // collapsed into the top-left corner instead of staying where it had been dropped.
    const stored = { x: 0.92, y: 0.06 }
    const resting = resolvePosition(null, stored, VIEW)
    assert.ok(Number.isFinite(resting.left) && Number.isFinite(resting.top))
    assert.ok(resting.left > 0 && resting.top > 0, 'a resting bubble is never at the origin')
    assert.equal(resting.left, 0.92 * VIEW.width)

    // Mid-drag it tracks the pointer exactly rather than the stored ratio.
    assert.deepEqual(resolvePosition({ x: 321, y: 123 }, stored, VIEW), { left: 321, top: 123 })
})

test('a corrupt stored ratio still resolves on screen rather than off it', () => {
    for (const stored of [{ x: -3, y: 9 }, { x: Number.NaN, y: Number.NaN }]) {
        const at = resolvePosition(null, stored, VIEW)
        assert.ok(at.left >= 0 && at.left <= VIEW.width, `left ${at.left}`)
        assert.ok(at.top >= 0 && at.top <= VIEW.height, `top ${at.top}`)
    }
})
