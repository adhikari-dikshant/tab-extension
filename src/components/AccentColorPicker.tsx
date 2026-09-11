import { Palette } from 'lucide-react'
import { ACCENT_PRESETS, type Settings } from '../lib/storage'

export function AccentColorPicker({
    accentColor,
    onChange,
}: {
    accentColor: string
    onChange: (accentColor: Settings['accentColor']) => void
}) {
    return (
        <div className="flex flex-wrap items-center gap-2 py-2">
            {ACCENT_PRESETS.map((color) => (
                <button
                    key={color}
                    type="button"
                    onClick={() => onChange(color)}
                    aria-label={`Use ${color} accent`}
                    className="h-8 w-8 rounded-full transition"
                    style={{
                        backgroundColor: color,
                        boxShadow: accentColor === color ? `0 0 0 2px #fff, 0 0 0 4px ${color}` : undefined,
                    }}
                />
            ))}
            <label
                title="Custom color"
                className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-dashed border-black/20 text-neutral-400 dark:border-white/20"
            >
                <Palette className="h-4 w-4" />
                <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => onChange(e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                />
            </label>
        </div>
    )
}
