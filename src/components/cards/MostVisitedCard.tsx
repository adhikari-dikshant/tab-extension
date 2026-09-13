import { useEffect, useState } from 'react'
import { CompassIcon } from '@phosphor-icons/react/dist/csr/Compass'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { BentoCard } from '../BentoGrid'
import { CardEmpty, CardSkeleton } from '../CardState'
import { ShortcutIcon } from '../ShortcutIcon'
import { useStorageValue } from '../../lib/useStorageValue'

const REQUIRED_PERMISSIONS: chrome.runtime.ManifestPermission[] = ['topSites']

export default function MostVisitedCard() {
    const [permission, setPermission] = useState<'checking' | 'granted' | 'denied'>('checking')
    const [sites, setSites] = useState<chrome.topSites.MostVisitedURL[] | null>(null)
    const [shortcuts, setShortcuts] = useStorageValue('shortcuts', [])

    useEffect(() => {
        chrome.permissions.contains({ permissions: REQUIRED_PERMISSIONS }, (granted) => {
            setPermission(granted ? 'granted' : 'denied')
            if (granted) chrome.topSites.get(setSites)
        })
    }, [])

    const requestAccess = () => {
        chrome.permissions.request({ permissions: REQUIRED_PERMISSIONS }, (granted) => {
            setPermission(granted ? 'granted' : 'denied')
            if (granted) chrome.topSites.get(setSites)
        })
    }
    const addAsShortcut = (site: chrome.topSites.MostVisitedURL) => {
        if (shortcuts.some((shortcut) => shortcut.url === site.url)) return
        setShortcuts([...shortcuts, { id: crypto.randomUUID(), label: site.title || site.url, url: site.url }])
    }
    return <BentoCard title="Most visited" className="visited-card" action={sites?.length ? <span className="card-meta">{sites.length} SITES</span> : undefined}>
        {permission === 'checking' || (permission === 'granted' && sites === null) ? <CardSkeleton /> : permission === 'denied' ? <CardEmpty>
            <span className="empty-illustration"><CompassIcon size={25} /></span><strong>Your usual corner of the internet.</strong><p className="mb-2">Keep your frequently visited sites close.</p>
            <button type="button" onClick={requestAccess} className="productivity-button mt-5">Enable most visited</button>
        </CardEmpty> : !sites?.length ? <CardEmpty>Nothing yet — browse a bit and this fills in automatically.</CardEmpty> : <ul className="visited-list">
            {sites.map((site) => <li key={site.url} className="visited-item group relative">
                <button type="button" onClick={() => window.open(site.url, '_self')} title={site.title} className="visited-link"><ShortcutIcon url={site.url} label={site.title} className="h-5 w-5" /><span>{site.title || site.url}</span></button>
                <button type="button" onClick={() => addAsShortcut(site)} aria-label={`Add ${site.title} to shortcuts`} className="visited-save icon-control"><PlusIcon size={14} /></button>
            </li>)}
        </ul>}
    </BentoCard>
}
