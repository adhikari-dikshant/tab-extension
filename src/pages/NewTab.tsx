import { useEffect } from 'react'
import Clock from '../components/Clock'
import Greeting from '../components/Greeting'
import CustomTextWidget from '../components/CustomTextWidget'
import CommandBar from '../components/CommandBar'
import QuoteWidget from '../components/QuoteWidget'
import BookmarksButton from '../components/BookmarksButton'
import GoogleAppsButton from '../components/GoogleAppsButton'
import AiToolsButton from '../components/AiToolsButton'
import SettingsButton from '../components/SettingsButton'
import { BentoGrid } from '../components/BentoGrid'
import ShortcutsCard from '../components/cards/ShortcutsCard'
import TodoCard from '../components/cards/TodoCard'
import WeatherCard from '../components/cards/WeatherCard'
import ScreenTimeCard from '../components/cards/ScreenTimeCard'
import { DEFAULT_SETTINGS, ensureDefaultAiTools, ensureDefaultShortcuts } from '../lib/storage'
import { useStorageValue } from '../lib/useStorageValue'
import { useAppearance } from '../lib/useAppearance'

export default function NewTab() {
    useAppearance()
    const [settings] = useStorageValue('settings', DEFAULT_SETTINGS)

    useEffect(() => {
        void ensureDefaultShortcuts()
        void ensureDefaultAiTools()
    }, [])

    const isEnabled = (id: (typeof settings.widgetsEnabled)[number]) => settings.widgetsEnabled.includes(id)

    const wallpaperStyle =
        settings.wallpaper.type !== 'none' && settings.wallpaper.value
            ? {
                  backgroundImage: `url(${settings.wallpaper.value})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundAttachment: 'fixed',
              }
            : undefined

    return (
        <div
            style={wallpaperStyle}
            className="relative flex min-h-screen flex-col items-center gap-8 bg-white px-6 py-12 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
        >
            <div className="absolute right-6 top-6 flex items-center gap-1">
                {isEnabled('bookmarks') && <BookmarksButton />}
                {isEnabled('googleApps') && <GoogleAppsButton />}
                {isEnabled('aiTools') && <AiToolsButton />}
                <SettingsButton />
            </div>

            {isEnabled('clock') && <Clock />}
            {isEnabled('customText') && <CustomTextWidget />}
            {isEnabled('greeting') && <Greeting />}
            <CommandBar />
            {isEnabled('quotes') && <QuoteWidget />}

            <BentoGrid>
                {isEnabled('shortcuts') && <ShortcutsCard />}
                {isEnabled('todo') && <TodoCard />}
                {isEnabled('weather') && <WeatherCard />}
                {isEnabled('screentime') && <ScreenTimeCard />}
            </BentoGrid>
        </div>
    )
}
