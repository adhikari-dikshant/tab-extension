import * as RadixSwitch from '@radix-ui/react-switch'

export function Switch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (checked: boolean) => void }) {
    return (
        <RadixSwitch.Root
            checked={checked}
            onCheckedChange={onCheckedChange}
            className="relative h-6 w-11 shrink-0 rounded-full bg-black/15 outline-none transition-colors data-[state=checked]:bg-(--accent) dark:bg-white/15"
        >
            <RadixSwitch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
        </RadixSwitch.Root>
    )
}
