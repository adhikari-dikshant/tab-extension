import { useRef, useState } from 'react'
import { ImageSquareIcon as ImagePlus } from '@phosphor-icons/react/dist/csr/ImageSquare'
import { ShuffleIcon as Shuffle } from '@phosphor-icons/react/dist/csr/Shuffle'
import { TrashIcon as Trash2 } from '@phosphor-icons/react/dist/csr/Trash'
import type { Settings } from '../lib/storage'

// Wallpapers are stored inline in chrome.storage.local as a data URL (no IndexedDB layer here
// yet), so keep uploads modest — this cap leaves headroom for everything else we store there.
const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024

export function WallpaperPicker({
    wallpaper,
    onChange,
}: {
    wallpaper: Settings['wallpaper']
    onChange: (wallpaper: Settings['wallpaper']) => void
}) {
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFile = (file: File) => {
        if (!file.type.startsWith('image/')) return
        if (file.size > MAX_UPLOAD_BYTES) {
            setError(`Image is too large — keep it under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.`)
            return
        }
        setError(null)
        const reader = new FileReader()
        reader.onload = () => {
            onChange({ type: 'upload', value: reader.result as string })
        }
        reader.readAsDataURL(file)
    }

    const shuffle = () => {
        const seed = Math.floor(Math.random() * 1_000_000)
        onChange({ type: 'daily-random', value: `https://picsum.photos/seed/${seed}/1600/900` })
    }

    const clear = () => {
        onChange({ type: 'none', value: null })
        setError(null)
    }

    return (
        <div className="space-y-2 py-2">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1.5 text-xs font-medium dark:bg-white/10"
                >
                    <ImagePlus className="h-3.5 w-3.5" />
                    Upload wallpaper
                </button>
                <button
                    type="button"
                    onClick={shuffle}
                    aria-label="Random wallpaper"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
                >
                    <Shuffle className="h-3.5 w-3.5" />
                </button>
                {wallpaper.type !== 'none' && (
                    <button
                        type="button"
                        onClick={clear}
                        aria-label="Remove wallpaper"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-red-500 dark:bg-white/10"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFile(file)
                        e.target.value = ''
                    }}
                />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            {wallpaper.type !== 'none' && wallpaper.value && (
                <img src={wallpaper.value} alt="Current wallpaper" className="h-16 w-28 rounded-lg object-cover" />
            )}
        </div>
    )
}
