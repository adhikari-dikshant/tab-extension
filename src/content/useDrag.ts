import { useCallback, useRef, useState } from 'react'
import { exceededThreshold } from '../lib/overlayPosition'

export interface DragState {
    /** True once the pointer has moved past the threshold, so a click is not mistaken for a drag. */
    dragging: boolean
    /** Live pointer position in viewport pixels while dragging, else null. */
    point: { x: number; y: number } | null
}

/**
 * Pointer-drag for a floating overlay element.
 *
 * Uses pointer capture so the drag survives the pointer crossing an iframe, a video, or any element
 * on the host page that would otherwise swallow the move events — a drag that dies halfway across
 * the window because it passed over an ad frame is the usual way this breaks.
 *
 * `onDrop` receives the final position; nothing is written to storage until then, so dragging does
 * not produce a write per frame.
 */
export function useDrag(onDrop: (point: { x: number; y: number }) => void) {
    const [state, setState] = useState<DragState>({ dragging: false, point: null })
    const origin = useRef<{ x: number; y: number } | null>(null)
    // Where in the element the grab happened, so it does not jump its own centre under the pointer.
    const grabOffset = useRef({ x: 0, y: 0 })
    const moved = useRef(false)

    const onPointerDown = useCallback((event: React.PointerEvent) => {
        // Primary button only: a right-click or a middle-click is not a drag.
        if (event.button !== 0) return
        const target = event.currentTarget as HTMLElement
        const rect = target.getBoundingClientRect()
        grabOffset.current = {
            x: event.clientX - (rect.left + rect.width / 2),
            y: event.clientY - (rect.top + rect.height / 2),
        }
        origin.current = { x: event.clientX, y: event.clientY }
        moved.current = false
        target.setPointerCapture(event.pointerId)
    }, [])

    const onPointerMove = useCallback((event: React.PointerEvent) => {
        const from = origin.current
        if (!from) return
        const here = { x: event.clientX, y: event.clientY }
        if (!moved.current && !exceededThreshold(from, here)) return
        moved.current = true
        // Stops the host page starting a text selection or its own drag behind the bubble.
        event.preventDefault()
        setState({
            dragging: true,
            point: { x: here.x - grabOffset.current.x, y: here.y - grabOffset.current.y },
        })
    }, [])

    const finish = useCallback((event: React.PointerEvent) => {
        const target = event.currentTarget as HTMLElement
        if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
        if (moved.current) {
            onDrop({
                x: event.clientX - grabOffset.current.x,
                y: event.clientY - grabOffset.current.y,
            })
        }
        origin.current = null
        setState({ dragging: false, point: null })
    }, [onDrop])

    /** True for the click immediately following a drag, so the handler can ignore it. */
    const consumedClick = useCallback(() => moved.current, [])

    return {
        ...state,
        consumedClick,
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp: finish,
            onPointerCancel: finish,
        },
    }
}
