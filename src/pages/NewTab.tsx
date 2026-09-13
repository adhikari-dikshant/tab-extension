import { useEffect, type ReactNode } from 'react'
import { HouseSimpleIcon as House } from '@phosphor-icons/react/dist/csr/HouseSimple'
import Clock from '../components/Clock'
import Greeting from '../components/Greeting'
import CustomTextWidget from '../components/CustomTextWidget'
import CommandBar from '../components/CommandBar'
import QuoteWidget from '../components/QuoteWidget'
import BookmarksButton from '../components/BookmarksButton'
import GoogleAppsButton from '../components/GoogleAppsButton'
import AiToolsButton from '../components/AiToolsButton'
import RecentlyClosedButton from '../components/RecentlyClosedButton'
import SettingsButton from '../components/SettingsButton'
import DashboardGrid from '../components/DashboardGrid'
import NotesButton from '../components/NotesButton'
import FocusButton from '../components/FocusButton'
import { DEFAULT_SETTINGS, ensureDefaultAiTools, ensureDefaultShortcuts } from '../lib/storage'
import { useStorageValue } from '../lib/useStorageValue'
import { useAppearance } from '../lib/useAppearance'

function RailItem({ label, children }: { label: string; children: ReactNode }) {
    return <div className="rail-item" title={label}>{children}<span aria-hidden="true">{label}</span></div>
}

export default function NewTab() {
    useAppearance()
    const [settings] = useStorageValue('settings', DEFAULT_SETTINGS)

    useEffect(() => {
        void ensureDefaultShortcuts()
        void ensureDefaultAiTools()
    }, [])

    const isEnabled = (id: (typeof settings.widgetsEnabled)[number]) => settings.widgetsEnabled.includes(id)
    const wallpaperStyle = settings.wallpaper.type !== 'none' && settings.wallpaper.value
        ? { backgroundImage: `url(${settings.wallpaper.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : undefined

    return (
        <div style={wallpaperStyle} className="dashboard-shell">
            <aside className="utility-rail" aria-label="Dashboard tools">
                <a className="brand-mark" href="#dashboard" title="Home" aria-label="Home" aria-current="page"><House size={23} /></a>
                <div className="rail-navigation">
                    {isEnabled('bookmarks') && <RailItem label="Bookmarks"><BookmarksButton /></RailItem>}
                    {isEnabled('googleApps') && <RailItem label="Apps"><GoogleAppsButton /></RailItem>}
                    {isEnabled('aiTools') && <RailItem label="AI tools"><AiToolsButton /></RailItem>}
                    {settings.notesEnabled && <RailItem label="Notes"><NotesButton /></RailItem>}
                    {isEnabled('recentlyClosed') && <RailItem label="Recent"><RecentlyClosedButton /></RailItem>}
                </div>
                <RailItem label="Customize"><SettingsButton /></RailItem>
            </aside>

            <main id="dashboard" className="dashboard-main">
                <section className="welcome-panel" aria-label="Welcome">
                    <div className="welcome-copy">
                        <span className="eyebrow"><span className="status-dot" /> YOUR DAILY SPACE</span>
                        {isEnabled('greeting') ? <Greeting /> : <h1>Make room for a good day.</h1>}
                        {isEnabled('quotes') && <QuoteWidget />}
                        {isEnabled('customText') && settings.customText.trim() && <CustomTextWidget />}
                    </div>
                    {(isEnabled('clock') || settings.focusEnabled) && <div className="welcome-clock">{isEnabled('clock') && <Clock />}{settings.focusEnabled && <FocusButton />}</div>}
                    <div className="welcome-orbit orbit-one" aria-hidden="true" /><div className="welcome-orbit orbit-two" aria-hidden="true" />
                </section>

                <section className="search-section" aria-label="Search and commands">
                    <CommandBar />
                </section>

                <DashboardGrid />
            </main>
        </div>
    )
}
