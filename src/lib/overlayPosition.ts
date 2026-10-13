/**
 * Where the overlay's two floating pieces sit, and how a drop resolves to a resting place.
 *
 * Positions are stored as ratios of the viewport rather than pixels: a bubble parked against the
 * right edge of a wide window must still be against the right edge in a narrow one, and a pixel
 * offset saved on a 2560px monitor would put it off-screen on a laptop.
 */

/** The tasks/notes handle attaches to a side only — it is a vertical column of buttons, and the
 * shapes that read correctly on the top or bottom edge are different shapes entirely. */
export type EdgeSide = 'left' | 'right'

export interface HandlePosition {
    side: EdgeSide
    /** Centre of the handle down the edge, 0 (top) to 1 (bottom). */
    offsetY: number
}

export interface TimerPosition {
    /** Centre of the timer, as ratios of the viewport. */
    x: number
    y: number
}

export interface Viewport {
    width: number
    height: number
}

export interface Size {
    width: number
    height: number
}

export const DEFAULT_HANDLE: HandlePosition = { side: 'left', offsetY: 0.5 }
export const DEFAULT_TIMER: TimerPosition = { x: 0.92, y: 0.06 }

function clamp(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) return min
    return Math.min(max, Math.max(min, value))
}

/**
 * Resolves a drop anywhere on the page to a resting place on the nearest side edge.
 *
 * "Nearest" is the shortest straight path to an edge the handle is allowed to occupy: the distance
 * left is the drop's own x, the distance right is whatever remains. Dropping dead centre resolves
 * left, which is arbitrary but has to be decided somewhere, and matches the default side.
 *
 * The vertical offset is kept — a handle dropped near the top stays near the top — but clamped so
 * the bubble can never hang half off the screen, whatever its height.
 */
export function snapHandleToEdge(point: { x: number; y: number }, viewport: Viewport, handleHeight: number): HandlePosition {
    const width = Math.max(1, viewport.width)
    const height = Math.max(1, viewport.height)

    const distanceLeft = clamp(point.x, 0, width)
    const distanceRight = width - distanceLeft
    const side: EdgeSide = distanceLeft <= distanceRight ? 'left' : 'right'

    // Half the handle must fit above and below its centre. On a viewport shorter than the handle
    // there is no such band, so it centres rather than jumping to an edge.
    const half = Math.min(handleHeight, height) / 2
    const margin = half / height
    const offsetY = margin * 2 >= 1 ? 0.5 : clamp(point.y / height, margin, 1 - margin)

    return { side, offsetY }
}

/**
 * Keeps the timer fully on screen wherever it is dropped. Unlike the handle it does not snap: it is
 * a small readout the user places deliberately, and a timer that slides somewhere else on release
 * would be fighting them.
 */
export function clampTimer(point: { x: number; y: number }, viewport: Viewport, size: Size): TimerPosition {
    const width = Math.max(1, viewport.width)
    const height = Math.max(1, viewport.height)

    const halfWidth = Math.min(size.width, width) / 2
    const halfHeight = Math.min(size.height, height) / 2
    const marginX = halfWidth / width
    const marginY = halfHeight / height

    return {
        x: marginX * 2 >= 1 ? 0.5 : clamp(point.x / width, marginX, 1 - marginX),
        y: marginY * 2 >= 1 ? 0.5 : clamp(point.y / height, marginY, 1 - marginY),
    }
}

/** Pixel position for a stored handle, for the inline style the overlay applies. */
export function handleStyle(position: HandlePosition, viewport: Viewport) {
    return { top: clamp(position.offsetY, 0, 1) * viewport.height }
}

/** A drag only counts once the pointer has moved past this, so a slightly shaky click still opens
 * the panel instead of being swallowed as a drag that went nowhere. */
export const DRAG_THRESHOLD_PX = 4

export function exceededThreshold(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
    return Math.hypot(to.x - from.x, to.y - from.y) > DRAG_THRESHOLD_PX
}
