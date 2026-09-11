import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Bookmark, CircleUserRound, Grid3x3, Palette, Store, type LucideIcon } from 'lucide-react'

function productIcon(slug: string): string {
    return `https://www.gstatic.com/images/branding/product/2x/${slug}_48dp.png`
}

type AppEntry = { label: string; url: string } & ({ icon: string } | { Icon: LucideIcon })

const APPS: AppEntry[] = [
    { label: 'Account', url: 'https://myaccount.google.com', Icon: CircleUserRound },
    { label: 'Search', url: 'https://www.google.com', icon: productIcon('googleg') },
    { label: 'YouTube', url: 'https://youtube.com', icon: productIcon('youtube') },
    { label: 'Gmail', url: 'https://mail.google.com', icon: productIcon('gmail') },
    { label: 'YT Music', url: 'https://music.youtube.com', icon: productIcon('youtube_music') },
    { label: 'Maps', url: 'https://maps.google.com', icon: productIcon('maps') },
    { label: 'Play', url: 'https://play.google.com', icon: productIcon('play') },
    { label: 'Drive', url: 'https://drive.google.com', icon: productIcon('drive') },
    { label: 'Photos', url: 'https://photos.google.com', icon: productIcon('photos') },
    { label: 'Translate', url: 'https://translate.google.com', icon: productIcon('translate') },
    { label: 'Calendar', url: 'https://calendar.google.com', icon: productIcon('calendar') },
    { label: 'Meet', url: 'https://meet.google.com', icon: productIcon('meet') },
    { label: 'Chat', url: 'https://chat.google.com', icon: productIcon('chat') },
    { label: 'News', url: 'https://news.google.com', icon: productIcon('news') },
    { label: 'Contacts', url: 'https://contacts.google.com', icon: productIcon('contacts') },
    { label: 'My Ad Center', url: 'https://myadcenter.google.com', icon: productIcon('my_ad_center') },
    { label: 'Business Profile', url: 'https://business.google.com', Icon: Store },
    { label: 'Shopping', url: 'https://shopping.google.com', icon: productIcon('shopping') },
    { label: 'Docs', url: 'https://docs.google.com', icon: productIcon('docs') },
    { label: 'Sheets', url: 'https://sheets.google.com', icon: productIcon('sheets') },
    { label: 'Slides', url: 'https://slides.google.com', icon: productIcon('slides') },
    { label: 'Forms', url: 'https://forms.google.com', icon: productIcon('forms') },
    { label: 'Keep', url: 'https://keep.google.com', icon: productIcon('keep') },
    { label: 'Trends', url: 'https://trends.google.com', icon: productIcon('trends') },
    { label: 'Google Ads', url: 'https://ads.google.com', icon: productIcon('ads') },
    { label: 'Analytics', url: 'https://analytics.google.com', icon: productIcon('analytics') },
    { label: 'Password Manager', url: 'https://passwords.google.com', icon: productIcon('password_manager') },
    { label: 'Google One', url: 'https://one.google.com', icon: productIcon('one') },
    { label: 'Travel', url: 'https://www.google.com/travel', icon: productIcon('travel') },
    { label: 'Classroom', url: 'https://classroom.google.com', icon: productIcon('classroom') },
    { label: 'Books', url: 'https://play.google.com/store/books', icon: productIcon('play_books') },
    { label: 'Blogger', url: 'https://www.blogger.com', icon: productIcon('blogger') },
    { label: 'Earth', url: 'https://earth.google.com', icon: productIcon('earth') },
    { label: 'Arts & Culture', url: 'https://artsandculture.google.com', Icon: Palette },
    { label: 'Saved', url: 'https://www.google.com/save', Icon: Bookmark },
    { label: 'Chrome Web Store', url: 'https://chromewebstore.google.com', icon: productIcon('chrome') },
]

export default function GoogleAppsButton() {
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button
                    type="button"
                    aria-label="Google apps"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10"
                >
                    <Grid3x3 className="h-5 w-5" />
                </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="end"
                    sideOffset={8}
                    className="dropdown-animate z-30 w-80 rounded-2xl border border-black/10 bg-white p-3 shadow-xl outline-none dark:border-white/10 dark:bg-neutral-900"
                >
                    <div className="themed-scrollbar grid max-h-96 grid-cols-4 gap-1 overflow-y-auto">
                        {APPS.map((app) => (
                            <DropdownMenu.Item key={app.url} asChild>
                                <a
                                    href={app.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={app.label}
                                    className="flex flex-col items-center gap-1 rounded-lg p-2 outline-none hover:bg-black/5 focus:bg-black/5 dark:hover:bg-white/10 dark:focus:bg-white/10"
                                >
                                    {'icon' in app ? (
                                        <img src={app.icon} alt="" className="h-9 w-9" />
                                    ) : (
                                        <app.Icon className="h-9 w-9 text-neutral-400" />
                                    )}
                                    <span className="max-w-full truncate text-center text-[10px] text-neutral-500 dark:text-neutral-400">
                                        {app.label}
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
