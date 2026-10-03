import { useEffect, useState } from 'react'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { CompassIcon } from '@phosphor-icons/react/dist/csr/Compass'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { BentoCard } from '../BentoGrid'
import { CardEmpty, CardSkeleton } from '../CardState'
import { ShortcutIcon } from '../ShortcutIcon'
import { createShortcut } from '../../lib/storage'
import { useStorageValue } from '../../lib/useStorageValue'

const REQUIRED_PERMISSIONS: chrome.runtime.ManifestPermission[] = ['topSites']

function hostOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return url
    }
}

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
    const isSaved = (site: chrome.topSites.MostVisitedURL) => shortcuts.some((shortcut) => shortcut.url === site.url)
    const addAsShortcut = (site: chrome.topSites.MostVisitedURL) => {
        if (isSaved(site)) return
        setShortcuts([...shortcuts, createShortcut(site.title || site.url, site.url)])
    }
    return <BentoCard title="Most visited" className="visited-card" action={sites?.length ? <span className="card-meta">{sites.length} SITES</span> : undefined}>
        {permission === 'checking' || (permission === 'granted' && sites === null) ? <CardSkeleton /> : permission === 'denied' ? <CardEmpty>
            <span className="empty-illustration"><CompassIcon size={25} /></span><strong>Your usual corner of the internet.</strong><p className="mb-2">Keep your frequently visited sites close.</p>
            <button type="button" onClick={requestAccess} className="productivity-button mt-5">Enable most visited</button>
        </CardEmpty> : !sites?.length ? <CardEmpty>Nothing yet — browse a bit and this fills in automatically.</CardEmpty> : <ul className="visited-list">
            {sites.map((site) => {
                const saved = isSaved(site)
                const host = hostOf(site.url)
                return <li key={site.url} className="visited-item">
                    <a href={site.url} title={site.title || host} className="visited-link">
                        <span className="visited-icon"><ShortcutIcon url={site.url} label={site.title || host} className="visited-favicon" /></span>
                        <span className="visited-text">
                            <span className="visited-title">{site.title || host}</span>
                            <span className="visited-host">{host}</span>
                        </span>
                    </a>
                    <button
                        type="button"
                        onClick={() => addAsShortcut(site)}
                        aria-pressed={saved}
                        aria-label={saved ? `${site.title || host} is in shortcuts` : `Add ${site.title || host} to shortcuts`}
                        className="visited-save"
                    >
                        {saved ? <CheckIcon size={12} weight="bold" /> : <PlusIcon size={12} weight="bold" />}
                    </button>
                </li>
            })}
        </ul>}
    </BentoCard>
}
