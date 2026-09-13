import * as Accordion from '@radix-ui/react-accordion'
import { CaretUpIcon as ChevronUp } from '@phosphor-icons/react/dist/csr/CaretUp'
import type { ReactNode } from 'react'

export function SettingsAccordion({ children }: { children: ReactNode }) {
    return (
        <Accordion.Root
            type="multiple"
            defaultValue={['productivity', 'layout', 'shortcuts', 'personalization', 'clock', 'search', 'appearance', 'weather', 'privacy', 'data']}
            className="space-y-3 text-sm"
        >
            {children}
        </Accordion.Root>
    )
}

export function AccordionSection({ value, title, children }: { value: string; title: string; children: ReactNode }) {
    return (
        <Accordion.Item value={value} className="overflow-hidden rounded-2xl bg-black/[0.03] dark:bg-white/[0.06]">
            <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-center justify-between px-4 py-3 text-left font-medium outline-none">
                    {title}
                    <ChevronUp className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-data-[state=closed]:rotate-180" />
                </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="accordion-content overflow-hidden">
                <div className="divide-y divide-black/5 px-4 pb-3 dark:divide-white/10">{children}</div>
            </Accordion.Content>
        </Accordion.Item>
    )
}
