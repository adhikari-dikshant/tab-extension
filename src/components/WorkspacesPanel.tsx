import { useState } from 'react'
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash'
import { useStorageValue } from '../lib/useStorageValue'
import { changeStored, safeWebUrl } from '../lib/productivity'
import { useUndoDelete } from '../lib/useUndoDelete'
import { useToast } from '../lib/useToast'
import type { Workspace } from '../lib/storage'

export default function WorkspacesPanel() {
    const [workspaces] = useStorageValue('workspaces', [])
    const [name, setName] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const remove = useUndoDelete()
    const toast = useToast()
    const save = async () => {
        if (!name.trim()) return
        setBusy(true); setError('')
        try {
            // Called directly from the user's click so Chrome can show its permission prompt.
            const granted = await chrome.permissions.request({ permissions: ['tabs'] })
            if (!granted) { setError('Allow access to tabs to save this window.'); return }
            const tabs = await chrome.tabs.query({ currentWindow: true })
            const saved = tabs.filter((tab) => !tab.incognito && tab.url && safeWebUrl(tab.url)).map((tab) => ({ title: tab.title || tab.url!, url: tab.url!, pinned: tab.pinned }))
            if (!saved.length) { setError('There are no regular web tabs to save in this window.'); return }
            await changeStored('workspaces', [], (items) => [...items, { id: crypto.randomUUID(), name: name.trim(), tabs: saved, createdAt: Date.now() }])
            setName(''); toast(`Saved ${saved.length} tabs`)
        } catch { setError('Could not save these tabs. Please try again.') }
        finally { setBusy(false) }
    }
    const open = async (workspace: Workspace) => {
        setBusy(true); setError('')
        try {
            const tabs = workspace.tabs.filter((tab) => safeWebUrl(tab.url))
            if (!tabs.length) { setError('This workspace has no valid web links.'); return }
            const win = await chrome.windows.create({ url: tabs.map((tab) => tab.url) })
            for (let i = 0; i < tabs.length; i++) {
                const id = win?.tabs?.[i]?.id
                if (tabs[i].pinned && id !== undefined) await chrome.tabs.update(id, { pinned: true })
            }
            toast(`Opened ${tabs.length} tabs in a new window`)
        } catch { setError('Could not finish opening this workspace. Check the new window before trying again.') }
        finally { setBusy(false) }
    }
    return <>
        <div className="productivity-form">
            <label>Workspace name<input aria-label="Workspace name" placeholder="Work, research, weekend…" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
            <button className="productivity-button mt-5 primary" disabled={busy || !name.trim()} onClick={() => void save()}>{busy ? 'Working…' : 'Save current window'}</button>
            <p className="productivity-muted">Saves web tabs from this window. Private tabs are excluded. Your open tabs stay as they are.</p>
        </div>
        {error && <p className="productivity-error" role="alert">{error}</p>}
        {workspaces.length ? <ul className="workspace-list">{workspaces.map((workspace) => <li key={workspace.id}>
            <div className="productivity-toolbar"><strong>{workspace.name}</strong><button className="icon-control" aria-label={`Delete ${workspace.name} workspace`} onClick={() => void remove('workspaces', workspace.id, 'Workspace')}><TrashIcon size={17} /></button></div>
            <span className="productivity-muted">{workspace.tabs.length} tabs · {new Date(workspace.createdAt).toLocaleDateString()}</span>
            <details><summary>View saved tabs</summary><ul>{workspace.tabs.map((tab, index) => <li key={`${tab.url}-${index}`}><a href={safeWebUrl(tab.url) ? tab.url : undefined} target="_blank" rel="noreferrer">{tab.title}</a></li>)}</ul></details>
            <button className="productivity-button mt-5" disabled={busy} onClick={() => void open(workspace)}>Open workspace</button>
        </li>)}</ul> : <div className="offcanvas-empty">Save a project’s tabs and return to them together.</div>}
    </>
}
