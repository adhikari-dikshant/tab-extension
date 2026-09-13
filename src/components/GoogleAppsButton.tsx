import { Offcanvas } from './Offcanvas'
import { ShortcutIcon } from './ShortcutIcon'
import { BookmarkSimpleIcon as Bookmark } from '@phosphor-icons/react/dist/csr/BookmarkSimple'
import { UserCircleIcon as CircleUserRound } from '@phosphor-icons/react/dist/csr/UserCircle'
import { SquaresFourIcon as Grid3x3 } from '@phosphor-icons/react/dist/csr/SquaresFour'
import { PaletteIcon as Palette } from '@phosphor-icons/react/dist/csr/Palette'
import { StorefrontIcon as Store } from '@phosphor-icons/react/dist/csr/Storefront'
import type { Icon as IconComponent } from '@phosphor-icons/react/lib'

function productIcon(slug: string): string {
    return `https://www.gstatic.com/images/branding/product/2x/${slug}_48dp.png`
}

type AppEntry = { label: string; url: string } & ({ icon: string } | { Icon: IconComponent })

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
        <Offcanvas
            title="Apps"
            description="Your Google essentials, ready to open."
            icon={Grid3x3}
            trigger={<button type="button" aria-label="Google apps"><Grid3x3 size={20} /></button>}
        >
            <div className="launcher-grid">
                {APPS.map((app) => (
                    <a key={app.url} href={app.url} target="_blank" rel="noreferrer" className="launcher-tile">
                        <span className="launcher-icon">
                            {'icon' in app ? <ShortcutIcon url={app.url} label={app.label} icon={app.icon} className="h-8 w-8 rounded-lg" /> : <app.Icon size={32} />}
                        </span>
                        <span>{app.label}</span>
                    </a>
                ))}
            </div>
        </Offcanvas>
    )
}
