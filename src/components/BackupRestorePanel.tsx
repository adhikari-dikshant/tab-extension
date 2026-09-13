import { useRef, useState, type ChangeEvent } from 'react'
import { useStorageValue } from '../lib/useStorageValue'

function timeAgo(ts: number) {
    const mins = Math.floor((Date.now() - ts) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
}

export default function BackupRestorePanel() {
    const [lastExport, setLastExport] = useStorageValue('backup:lastExport', null)
    const [pendingImport, setPendingImport] = useState<Record<string, unknown> | null>(null)
    const [importError, setImportError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleExport = async () => {
        const all = await chrome.storage.local.get(null)
        const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `daily-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
        setLastExport(Date.now())
    }

    const handleFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        try {
            const parsed = JSON.parse(await file.text())
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                throw new Error('invalid shape')
            }
            setImportError(null)
            setPendingImport(parsed)
        } catch {
            setImportError("That file doesn't look like a valid backup.")
        }
    }

    const confirmImport = async () => {
        if (!pendingImport) return
        await chrome.storage.local.clear()
        await chrome.storage.local.set(pendingImport)
        setPendingImport(null)
    }

    return (
        <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
                <span>Backup & restore</span>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleExport}
                        className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/10"
                    >
                        Export
                    </button>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/10"
                    >
                        Import
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json"
                        onChange={handleFileChosen}
                        className="hidden"
                    />
                </div>
            </div>
            <p className="text-xs text-neutral-400">
                {lastExport ? `Last backed up ${timeAgo(lastExport)}` : 'Never backed up'} — this is a manual
                snapshot, not auto-sync.
            </p>

            {importError && <p className="text-xs text-red-500">{importError}</p>}

            {pendingImport && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
                    <p className="mb-2">
                        Importing overwrites everything currently saved (shortcuts, to-dos, settings). Continue?
                    </p>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setPendingImport(null)} className="text-neutral-400">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={confirmImport}
                            className="font-medium text-amber-600 dark:text-amber-400"
                        >
                            Overwrite
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
