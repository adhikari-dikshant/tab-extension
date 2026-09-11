import { useEffect, useRef, useState } from 'react'

interface MinimalSpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onerror: (() => void) | null
    onend: (() => void) | null
    start(): void
    stop(): void
}

declare global {
    interface Window {
        SpeechRecognition?: new () => MinimalSpeechRecognition
        webkitSpeechRecognition?: new () => MinimalSpeechRecognition
    }
}

function getRecognitionCtor() {
    return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

/** Feature-detected voice search (Web Speech API) — unsupported on Firefox and most mobile
 * browsers, so callers should hide the mic button entirely when `supported` is false. */
export function useVoiceSearch(onResult: (text: string, isFinal: boolean) => void) {
    const [listening, setListening] = useState(false)
    const recognitionRef = useRef<MinimalSpeechRecognition | null>(null)
    const supported = getRecognitionCtor() !== null

    useEffect(() => {
        return () => recognitionRef.current?.stop()
    }, [])

    const toggle = () => {
        if (listening) {
            recognitionRef.current?.stop()
            setListening(false)
            return
        }

        const Ctor = getRecognitionCtor()
        if (!Ctor) return

        const recognition = new Ctor()
        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = navigator.language

        recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1]
            onResult(result[0].transcript, result.isFinal)
        }
        recognition.onerror = () => setListening(false)
        recognition.onend = () => setListening(false)

        recognitionRef.current = recognition
        recognition.start()
        setListening(true)
    }

    return { supported, listening, toggle }
}
