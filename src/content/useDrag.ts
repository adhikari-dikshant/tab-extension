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
 * The handlers go on the whole bubble, not on a small grip: a grip means hunting for a 10px target
 * before anything moves, and the first thing anyone tries is dragging the body. Buttons inside stay
 * clickable because a press only becomes a drag once the pointer travels past a threshold.
 *
 * Pointer capture is taken at that moment rather than on pointer-down, which matters: a captured
 * pointer sends its `click` to the capturing element, so capturing eagerly would swallow every
 * click meant for a button inside. Capturing only once a real drag starts keeps plain clicks
 * untouched, while still letting the drag survive the pointer crossing an iframe, a video, or
 * anything else on the host page that would otherwise eat the move events.
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
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
        grabOffset.current = {
            x: event.clientX - (rect.left + rect.width / 2),
            y: event.clientY - (rect.top + rect.height / 2),
        }
        origin.current = { x: event.clientX, y: event.clientY }
        moved.current = false
    }, [])

    const onPointerMove = useCallback((event: React.PointerEvent) => {
        const from = origin.current
        if (!from) return
        const here = { x: event.clientX, y: event.clientY }
        if (!moved.current) {
            if (!exceededThreshold(from, here)) return
            moved.current = true
            try {
                (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
            } catch {
                // Pointer already gone; the drag still works, it just will not survive leaving the
                // element, which is better than throwing out of an event handler.
            }
        }
        // Stops the host page starting a text selection or its own drag behind the bubble.
        event.preventDefault()
        setState({
            dragging: true,
            point: { x: here.x - grabOffset.current.x, y: here.y - grabOffset.current.y },
        })
    }, [])

    const finish = useCallback((event: React.PointerEvent) => {
        const target = event.currentTarget as HTMLElement
        if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId)
        if (moved.current) {
            onDrop({
                x: event.clientX - grabOffset.current.x,
                y: event.clientY - grabOffset.current.y,
            })
        }
        origin.current = null
        setState({ dragging: false, point: null })
    }, [onDrop])

    /**
     * Swallows the click that follows a drag, so releasing over a button does not also press it.
     * Capture phase, so it runs before the button's own handler.
     */
    const onClickCapture = useCallback((event: React.MouseEvent) => {
        if (!moved.current) return
        event.preventDefault()
        event.stopPropagation()
        moved.current = false
    }, [])

    return {
        ...state,
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp: finish,
            onPointerCancel: finish,
            onClickCapture,
        },
    }
}
