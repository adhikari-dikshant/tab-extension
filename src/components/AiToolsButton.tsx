import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Bot } from 'lucide-react'
import { ShortcutIcon } from './ShortcutIcon'
import { useStorageValue } from '../lib/useStorageValue'

export default function AiToolsButton() {
    const [tools] = useStorageValue('aiTools', [])

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button
                    type="button"
                    aria-label="AI tools"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10"
                >
                    <Bot className="h-5 w-5" />
                </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="end"
                    sideOffset={8}
                    className="dropdown-animate z-30 w-80 rounded-2xl border border-black/10 bg-white p-3 shadow-xl outline-none dark:border-white/10 dark:bg-neutral-900"
                >
                    <div className="themed-scrollbar grid max-h-96 grid-cols-4 gap-1 overflow-y-auto">
                        {tools.map((tool) => (
                            <DropdownMenu.Item key={tool.id} asChild>
                                <a
                                    href={tool.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={tool.label}
                                    className="flex flex-col items-center gap-1 rounded-lg p-2 outline-none hover:bg-black/5 focus:bg-black/5 dark:hover:bg-white/10 dark:focus:bg-white/10"
                                >
                                    <ShortcutIcon url={tool.url} label={tool.label} icon={tool.icon} className="h-9 w-9 rounded-lg" />
                                    <span className="max-w-full truncate text-center text-[10px] text-neutral-500 dark:text-neutral-400">
                                        {tool.label}
                                    </span>
                                </a>
                            </DropdownMenu.Item>
                        ))}
                    </div>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    )
}
