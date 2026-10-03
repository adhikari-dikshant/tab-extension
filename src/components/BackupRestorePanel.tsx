import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useStorageValue } from '../lib/useStorageValue'
import { buildExport, mergeBackup, validateBackup, type BackupReport, type MergeSummary } from '../lib/backup'
import { ensureInstallId } from '../lib/storage'

function timeAgo(ts: number) {
    const mins = Math.floor((Date.now() - ts) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
}

type Mode = 'merge' | 'replace'

export default function BackupRestorePanel() {
    const [lastExport, setLastExport] = useStorageValue('backup:lastExport', null)
    const [pending, setPending] = useState<BackupReport | null>(null)
    const [mode, setMode] = useState<Mode>('merge')
    const [preview, setPreview] = useState<MergeSummary | null>(null)
    const [includeDeviceData, setIncludeDeviceData] = useState(false)
    const [importError, setImportError] = useState<string | null>(null)
    const [importing, setImporting] = useState(false)
    const [installId, setInstallId] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { void ensureInstallId().then(setInstallId) }, [])

    const handleExport = async () => {
        const stored = await chrome.storage.local.get(null)
        const envelope = buildExport(stored, {
            extensionVersion: chrome.runtime.getManifest().version,
            installId: installId || await ensureInstallId(),
            includeDeviceData,
        })
        const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `daily-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
        setLastExport(Date.now())
    }

    // Recompute the merge preview whenever the file or the chosen mode changes, so the confirmation
    // always describes the operation that is actually about to run.
    const refreshPreview = async (report: BackupReport, nextMode: Mode) => {
        if (nextMode === 'replace') { setPreview(null); return }
        const existing = await chrome.storage.local.get(null)
        setPreview(mergeBackup(existing, report.data))
    }

    const handleFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        try {
            // Validate the whole file before anything is shown as importable, so the confirmation
            // below can state exactly what will be written instead of promising the unknown.
            const report = validateBackup(JSON.parse(await file.text()), installId)
            if (report.error) {
                setPending(null)
                setPreview(null)
                setImportError(report.error)
                return
            }
            // Re-importing this device's own backup is a restore, not a sync between profiles.
            const nextMode: Mode = report.sameInstall ? 'replace' : 'merge'
            setImportError(null)
            setPending(report)
            setMode(nextMode)
            await refreshPreview(report, nextMode)
        } catch {
            setPending(null)
            setPreview(null)
            setImportError("That file couldn't be read as JSON.")
        }
    }

    const chooseMode = (next: Mode) => {
        setMode(next)
        if (pending) void refreshPreview(pending, next)
    }

    const confirmImport = async () => {
        if (!pending) return
        setImporting(true)
        // Hold on to the current contents so a failed write can be rolled back rather than
        // leaving storage half-cleared. Only validated keys get written.
        const snapshot = await chrome.storage.local.get(null)
        try {
            if (mode === 'replace') {
                await chrome.storage.local.clear()
                // installId belongs to this install, not to the file — a restore must not adopt
                // another profile's identity or later exports would misreport where they came from.
                await chrome.storage.local.set({ ...pending.data, installId: snapshot.installId ?? await ensureInstallId() })
            } else {
                await chrome.storage.local.set(mergeBackup(snapshot, pending.data).data)
            }
            setPending(null)
            setPreview(null)
            setImportError(null)
        } catch {
            try {
                await chrome.storage.local.clear()
                await chrome.storage.local.set(snapshot)
                setImportError('Import failed — your existing data was restored.')
            } catch {
                setImportError('Import failed and your data could not be restored. Reload this tab before making changes.')
            }
        } finally {
            setImporting(false)
        }
    }

    return (
        <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
                <span>Backup & restore</span>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void handleExport()}
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
                        onChange={(e) => void handleFileChosen(e)}
                        className="hidden"
                    />
                </div>
            </div>
            <p className="text-xs text-neutral-400">
                {lastExport ? `Last backed up ${timeAgo(lastExport)}` : 'Never backed up'} — this is a manual
                snapshot, not auto-sync.
            </p>
            <label className="flex items-center gap-2 text-xs text-neutral-400">
                <input type="checkbox" checked={includeDeviceData} onChange={(e) => setIncludeDeviceData(e.target.checked)} />
                Include screen-time history (only meaningful on this device)
            </label>

            {importError && <p className="text-xs text-red-500">{importError}</p>}

            {pending && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
                    <p className="mb-1">
                        {pending.schemaVersion === 0
                            ? 'An older backup, taken before backups were versioned. It contains:'
                            : `Backup from ${pending.exportedAt ? new Date(pending.exportedAt).toLocaleDateString() : 'an unknown date'}${pending.sameInstall ? ' — taken on this device' : ' — taken on another device'}. It contains:`}
                    </p>
                    <ul className="mb-2 list-inside list-disc">
                        {pending.accepted.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                    {pending.skipped.length > 0 && (
                        <p className="mb-2 text-neutral-500 dark:text-neutral-400">Skipped: {pending.skipped.join(', ')}.</p>
                    )}

                    <div className="mb-2 flex gap-1 rounded-full border border-black/10 p-0.5 dark:border-white/10">
                        {(['merge', 'replace'] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => chooseMode(option)}
                                aria-pressed={mode === option}
                                className={`flex-1 rounded-full px-2 py-1 ${mode === option ? 'bg-(--accent) text-white' : 'text-neutral-400'}`}
                            >
                                {option === 'merge' ? 'Merge' : 'Replace everything'}
                            </button>
                        ))}
                    </div>

                    {mode === 'merge' ? (
                        <div className="mb-2">
                            <p className="mb-1 text-neutral-500 dark:text-neutral-400">
                                Keeps what you have. Matching tasks, notes and links are updated only if the file's
                                copy is newer.
                            </p>
                            {preview && (
                                <ul className="list-inside list-disc">
                                    {preview.changes.map((change) => <li key={change}>{change}</li>)}
                                    {preview.held.length > 0 && <li>not merged: {preview.held.join(', ')}</li>}
                                </ul>
                            )}
                        </div>
                    ) : (
                        <p className="mb-2 text-neutral-500 dark:text-neutral-400">
                            Deletes everything currently saved first, including anything this file doesn't contain.
                        </p>
                    )}

                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setPending(null); setPreview(null) }} className="text-neutral-400">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => void confirmImport()}
                            disabled={importing}
                            className="font-medium text-amber-600 disabled:opacity-50 dark:text-amber-400"
                        >
                            {importing ? 'Importing…' : mode === 'merge' ? 'Merge into my data' : 'Replace my data'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
