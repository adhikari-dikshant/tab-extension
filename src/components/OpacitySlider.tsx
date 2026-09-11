import * as Slider from '@radix-ui/react-slider'

export function OpacitySlider({ opacity, onChange }: { opacity: number; onChange: (opacity: number) => void }) {
    return (
        <div className="flex items-center gap-3 py-2">
            <Slider.Root
                value={[opacity]}
                onValueChange={([v]) => onChange(v)}
                min={30}
                max={100}
                step={1}
                className="relative flex h-5 flex-1 touch-none items-center"
            >
                <Slider.Track className="relative h-1.5 grow rounded-full bg-black/10 dark:bg-white/15">
                    <Slider.Range className="absolute h-full rounded-full bg-(--accent)" />
                </Slider.Track>
                <Slider.Thumb
                    className="block h-4 w-4 rounded-full bg-(--accent) outline-none"
                    aria-label="Interface opacity"
                />
            </Slider.Root>
            <span className="w-10 shrink-0 text-right text-xs text-neutral-400">{opacity}%</span>
        </div>
    )
}
