import { useEffect, useState } from 'react'
import { GearSixIcon as Settings } from '@phosphor-icons/react/dist/csr/GearSix'
import { SlidersHorizontalIcon as SlidersHorizontal } from '@phosphor-icons/react/dist/csr/SlidersHorizontal'
import { Offcanvas } from './Offcanvas'
import { SettingsAccordion, AccordionSection } from './SettingsAccordion'
import { SettingRow } from './SettingRow'
import { Switch } from './Switch'
import { EditableLinkListPanel } from './EditableLinkListPanel'
import { AccentColorPicker } from './AccentColorPicker'
import { WallpaperPicker } from './WallpaperPicker'
import { OpacitySlider } from './OpacitySlider'
import BackupRestorePanel from './BackupRestorePanel'
import { DEFAULT_SETTINGS, type Settings as SettingsType, type Theme, type WidgetId } from '../lib/storage'
import { useToast } from '../lib/useToast'
import { useStorageValue } from '../lib/useStorageValue'

function SegmentedRow<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string
    value: T
    options: { value: T; label: string }[]
    onChange: (value: T) => void
}) {
    return (
        <div className="flex items-center justify-between py-2.5">
            <span className="font-medium">{label}</span>
            <div className="flex rounded-full border border-black/10 p-0.5 text-xs dark:border-white/10">
                {options.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        aria-pressed={value === opt.value}
                        className={`rounded-full px-2.5 py-1 ${
                            value === opt.value ? 'bg-(--accent) text-white' : 'text-neutral-400'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

function InlineEditButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-label="Manage list"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                open ? 'bg-(--accent) text-white' : 'bg-black/5 text-neutral-500 dark:bg-white/10 dark:text-neutral-400'
            }`}
        >
            <SlidersHorizontal className="h-3.5 w-3.5" />
        </button>
    )
}

function ScreenTimeRow({ settings, setSettings }: { settings: SettingsType; setSettings: (next: SettingsType) => void }) {
    const [granted, setGranted] = useState<boolean | null>(null)

    useEffect(() => {
        chrome.permissions.contains({ permissions: ['tabs', 'idle'] }, setGranted)
    }, [])

    const disable = () => {
        chrome.permissions.remove({ permissions: ['tabs', 'idle'] }, (removed) => {
            if (removed) {
                setGranted(false)
                setSettings({ ...settings, screenTimeEnabled: false })
            }
        })
    }

    return (
        <SettingRow label="Screen time tracking" description="Uses tabs + idle permissions">
            {granted === null ? (
                <span className="text-xs text-neutral-400">…</span>
            ) : granted ? (
                <button type="button" onClick={disable} className="text-xs text-red-500">
                    Turn off
                </button>
            ) : (
                <span className="text-xs text-neutral-400">Off</span>
            )}
        </SettingRow>
    )
}

export default function SettingsButton() {
    const toast = useToast()
    const [open, setOpen] = useState(false)
    const [editingShortcuts, setEditingShortcuts] = useState(false)
    const [editingAiTools, setEditingAiTools] = useState(false)
    const [settings, setSettings] = useStorageValue('settings', DEFAULT_SETTINGS)

    const toggleWidget = (id: WidgetId) => {
        const next = settings.widgetsEnabled.includes(id)
            ? settings.widgetsEnabled.filter((w) => w !== id)
            : [...settings.widgetsEnabled, id]
        setSettings({ ...settings, widgetsEnabled: next })
    }
    const isWidgetOn = (id: WidgetId) => settings.widgetsEnabled.includes(id)

    return (
        <Offcanvas
            open={open}
            onOpenChange={setOpen}
            title="Settings"
            description="A few adjustments to make this space yours."
            icon={Settings}
            trigger={<button type="button" aria-label="Settings"><Settings size={20} /></button>}
        >
            <SettingsAccordion>
                <AccordionSection value="productivity" title="Productivity">
                    <SettingRow label="Quick notes" description="Autosaving notes in their own dashboard card"><Switch label="Quick notes" checked={settings.notesEnabled} onCheckedChange={(notesEnabled) => setSettings({ ...settings, notesEnabled })} /></SettingRow>
                    <SettingRow label="Focus timer" description="Task-linked focus and break sessions"><Switch label="Focus timer" checked={settings.focusEnabled} onCheckedChange={(focusEnabled) => setSettings({ ...settings, focusEnabled })} /></SettingRow>
                    <SettingRow label="Desktop reminders" description="Focus completion and due tasks at 9 AM">
                        <Switch label="Desktop reminders" checked={settings.desktopReminders} onCheckedChange={async (enabled) => {
                            if (!enabled) { setSettings({ ...settings, desktopReminders: false }); return }
                            try {
                                const granted = await chrome.permissions.request({ permissions: ['notifications'] })
                                if (granted) setSettings({ ...settings, desktopReminders: true })
                                else toast('Allow notifications to receive desktop reminders.')
                            } catch { toast('Could not enable notifications. Please try again.') }
                        }} />
                    </SettingRow>
                </AccordionSection>
                <AccordionSection value="layout" title="Dashboard layout">
                    <p className="productivity-muted py-3">Reorder cards by dragging or using the arrow buttons. With six cards, choose a wider column; with five, choose a full-height card.</p>
                    <button className="productivity-button mt-5" onClick={() => { setOpen(false); window.dispatchEvent(new Event('dashboard:layout')) }}>Edit dashboard layout</button>
                </AccordionSection>
                <AccordionSection value="shortcuts" title="Shortcuts">
                    <SettingRow label="Shortcuts" description="Show saved shortcuts">
                        <Switch checked={isWidgetOn('shortcuts')} onCheckedChange={() => toggleWidget('shortcuts')} />
                    </SettingRow>
                    <SettingRow label="Edit Shortcuts" description="Choose which shortcuts get shown">
                        <InlineEditButton open={editingShortcuts} onToggle={() => setEditingShortcuts((v) => !v)} />
                    </SettingRow>
                    {editingShortcuts && (
                        <div className="py-2">
                            <EditableLinkListPanel storageKey="shortcuts" emptyMessage="No shortcuts yet — add some from the Shortcuts card." />
                        </div>
                    )}
                    <SettingRow label="Adaptive Icons" description="Shortcut icons will adapt to theme">
                        <Switch
                            checked={settings.adaptiveIcons}
                            onCheckedChange={(adaptiveIcons) => setSettings({ ...settings, adaptiveIcons })}
                        />
                    </SettingRow>
                </AccordionSection>

                <AccordionSection value="personalization" title="Personalization">
                    <SettingRow label="Bookmarks" description="Show bookmarks sidebar">
                        <Switch checked={isWidgetOn('bookmarks')} onCheckedChange={() => toggleWidget('bookmarks')} />
                    </SettingRow>
                    <SettingRow label="AI Tools" description="Show shortcuts for AI tools">
                        <Switch checked={isWidgetOn('aiTools')} onCheckedChange={() => toggleWidget('aiTools')} />
                    </SettingRow>
                    <SettingRow label="AI Tools Settings" description="Manage AI tools shortcuts">
                        <InlineEditButton open={editingAiTools} onToggle={() => setEditingAiTools((v) => !v)} />
                    </SettingRow>
                    {editingAiTools && (
                        <div className="py-2">
                            <EditableLinkListPanel storageKey="aiTools" emptyMessage="No AI tools yet." />
                        </div>
                    )}
                    <SettingRow label="Google Apps" description="Show shortcuts for Google Apps">
                        <Switch checked={isWidgetOn('googleApps')} onCheckedChange={() => toggleWidget('googleApps')} />
                    </SettingRow>
                    <SettingRow label="To Do List" description="Show a daily To Do list">
                        <Switch checked={isWidgetOn('todo')} onCheckedChange={() => toggleWidget('todo')} />
                    </SettingRow>
                    <SettingRow label="Most Visited" description="Auto-surface your most-visited sites">
                        <Switch checked={isWidgetOn('mostVisited')} onCheckedChange={() => toggleWidget('mostVisited')} />
                    </SettingRow>
                    <SettingRow label="Recently Closed Tabs" description="One-click reopen for closed tabs">
                        <Switch
                            checked={isWidgetOn('recentlyClosed')}
                            onCheckedChange={() => toggleWidget('recentlyClosed')}
                        />
                    </SettingRow>
                </AccordionSection>

                <AccordionSection value="clock" title="Clock">
                    <SettingRow label="Hide Clock" description="Hide the clock">
                        <Switch checked={!isWidgetOn('clock')} onCheckedChange={() => toggleWidget('clock')} />
                    </SettingRow>
                    <SettingRow label="Digital Clock" description="Switch to the digital clock" dimmed={!isWidgetOn('clock')}>
                        <Switch
                            checked={settings.clockStyle === 'digital'}
                            onCheckedChange={(digital) =>
                                setSettings({ ...settings, clockStyle: digital ? 'digital' : 'analog' })
                            }
                        />
                    </SettingRow>
                    <SettingRow label="12-Hour Format" description="Use 12-hour time format" dimmed={!isWidgetOn('clock')}>
                        <Switch
                            checked={settings.clockFormat === '12h'}
                            onCheckedChange={(is12h) => setSettings({ ...settings, clockFormat: is12h ? '12h' : '24h' })}
                        />
                    </SettingRow>
                    <SettingRow label="Customizable Text" description="Show custom text below the clock">
                        <Switch checked={isWidgetOn('customText')} onCheckedChange={() => toggleWidget('customText')} />
                    </SettingRow>
                    {isWidgetOn('customText') && (
                        <div className="py-2">
                            <input
                                value={settings.customText}
                                onChange={(e) => setSettings({ ...settings, customText: e.target.value })}
                                placeholder="Your text"
                                className="w-full rounded border border-black/10 bg-transparent px-2 py-1.5 text-sm outline-none dark:border-white/10"
                            />
                        </div>
                    )}
                    <SettingRow label="Greeting" description="Show greeting below custom text">
                        <Switch checked={isWidgetOn('greeting')} onCheckedChange={() => toggleWidget('greeting')} />
                    </SettingRow>
                    {isWidgetOn('greeting') && (
                        <div className="py-2">
                            <input
                                value={settings.greetingName}
                                onChange={(e) => setSettings({ ...settings, greetingName: e.target.value })}
                                placeholder="Your name (optional)"
                                className="w-full rounded border border-black/10 bg-transparent px-2 py-1.5 text-sm outline-none dark:border-white/10"
                            />
                        </div>
                    )}
                </AccordionSection>

                <AccordionSection value="search" title="Search">
                    <SettingRow label="Hide Microphone Icon" description="If voice typing is not working">
                        <Switch
                            checked={settings.hideMicrophone}
                            onCheckedChange={(hideMicrophone) => setSettings({ ...settings, hideMicrophone })}
                        />
                    </SettingRow>
                    <SettingRow label="Hide Search Engines" description="Switch between search engines by clicking its icon">
                        <Switch
                            checked={settings.hideSearchEngines}
                            onCheckedChange={(hideSearchEngines) => setSettings({ ...settings, hideSearchEngines })}
                        />
                    </SettingRow>
                    <SettingRow label="Motivational Quotes" description="Show a daily quote below the greeting">
                        <Switch checked={isWidgetOn('quotes')} onCheckedChange={() => toggleWidget('quotes')} />
                    </SettingRow>
                    <SettingRow label="Search Suggestions" description="Enable search suggestions">
                        <Switch
                            checked={settings.searchSuggestionsEnabled}
                            onCheckedChange={(searchSuggestionsEnabled) =>
                                setSettings({ ...settings, searchSuggestionsEnabled })
                            }
                        />
                    </SettingRow>
                </AccordionSection>

                <AccordionSection value="appearance" title="Appearance">
                    <div className="py-2">
                        <SegmentedRow<Theme>
                            label="Theme"
                            value={settings.theme}
                            onChange={(theme) => setSettings({ ...settings, theme })}
                            options={[
                                { value: 'light', label: 'Light' },
                                { value: 'dark', label: 'Dark' },
                                { value: 'system', label: 'Browser' },
                            ]}
                        />
                        <p className="text-xs text-neutral-400">Browser follows your browser’s light or dark preference.</p>
                    </div>
                    <div className="py-2">
                        <p className="mb-1 font-medium">Color scheme</p>
                        <p className="text-xs text-neutral-400">Applies to the dashboard’s cards, highlights, and controls.</p>
                        <AccentColorPicker
                            accentColor={settings.accentColor}
                            onChange={(accentColor) => setSettings({ ...settings, accentColor })}
                        />
                    </div>
                    <div className="py-2">
                        <p className="mb-1 font-medium">Wallpaper</p>
                        <WallpaperPicker
                            wallpaper={settings.wallpaper}
                            onChange={(wallpaper) => setSettings({ ...settings, wallpaper })}
                        />
                    </div>
                    <div className="py-2">
                        <p className="font-medium">Opacity</p>
                        <p className="mb-1 text-xs text-neutral-400">Adjust interface transparency</p>
                        <OpacitySlider
                            opacity={settings.opacity}
                            onChange={(opacity) => setSettings({ ...settings, opacity })}
                        />
                    </div>
                </AccordionSection>

                <AccordionSection value="weather" title="Weather">
                    <SegmentedRow
                        label="Units"
                        value={settings.tempUnit}
                        onChange={(tempUnit) => setSettings({ ...settings, tempUnit })}
                        options={[
                            { value: 'celsius', label: '°C' },
                            { value: 'fahrenheit', label: '°F' },
                        ]}
                    />
                </AccordionSection>

                <AccordionSection value="privacy" title="Privacy">
                    <ScreenTimeRow settings={settings} setSettings={setSettings} />
                </AccordionSection>

                <AccordionSection value="data" title="Data">
                    <div className="py-2">
                        <BackupRestorePanel />
                    </div>
                </AccordionSection>
            </SettingsAccordion>
        </Offcanvas>
    )
}
