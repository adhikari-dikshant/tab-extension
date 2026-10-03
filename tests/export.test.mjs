import test from 'node:test'
import assert from 'node:assert/strict'
import { buildExport, readEnvelope, validateBackup, mergeBackup } from '../src/lib/backup.ts'
import { DATA_SCHEMA_VERSION, EXPORT_APP_ID } from '../src/lib/storage.ts'

globalThis.crypto ??= (await import('node:crypto')).webcrypto

const stored = {
    settings: { settingsVersion: 1, theme: 'dark' },
    todos: [{ id: 't1', text: 'Task', done: false, pinned: false, createdAt: 1, updatedAt: 1 }],
    notes: [],
    'weather:cache': { fetchedAt: 1 },
    'backup:lastExport': 5,
    'screentime:2026-09-14': { totalSeconds: 60, domains: { 'a.com': 60 }, lastUpdated: 1 },
    installId: 'mine',
    schemaVersion: 1,
}
const opts = { extensionVersion: '0.0.1', installId: 'mine', now: 1000 }

test('an export describes itself and carries only the portable tier by default', () => {
    const file = buildExport(stored, { ...opts, includeDeviceData: false })
    assert.equal(file.app, EXPORT_APP_ID)
    assert.equal(file.schemaVersion, DATA_SCHEMA_VERSION)
    assert.equal(file.exportedAt, 1000)
    assert.deepEqual(file.exportedBy, { extensionVersion: '0.0.1', installId: 'mine' })
    assert.ok('todos' in file.data)
    assert.ok(!('weather:cache' in file.data), 'derived caches are not worth carrying')
    assert.ok(!('screentime:2026-09-14' in file.data), 'device history is excluded by default')
    assert.ok(!('installId' in file.data), 'an export never carries another install’s identity')
    assert.deepEqual(file.includes, ['portable'])
})

test('opting in includes device history and says so', () => {
    const file = buildExport(stored, { ...opts, includeDeviceData: true })
    assert.ok('screentime:2026-09-14' in file.data)
    assert.ok(!('installId' in file.data))
    assert.deepEqual(file.includes, ['device', 'portable'])
})

test('unknown keys are left out so the declared schema version stays truthful', () => {
    const file = buildExport({ ...stored, somethingNew: 1 }, { ...opts, includeDeviceData: true })
    assert.ok(!('somethingNew' in file.data))
})

test('a pre-envelope flat dump still imports, reported as schema 0', () => {
    // This is the shape of every backup taken before the envelope existed.
    const legacy = { settings: { theme: 'dark' }, todos: [{ id: 'a', text: 'Old task', createdAt: 7 }] }
    const unwrapped = readEnvelope(legacy)
    assert.equal(unwrapped.schemaVersion, 0)
    assert.deepEqual(unwrapped.payload, legacy)

    const report = validateBackup(legacy)
    assert.equal(report.error, undefined)
    assert.equal(report.schemaVersion, 0)
    assert.equal(report.exportedBy, undefined)
    // The record is repaired on the way in, so merge has timestamps to compare.
    assert.equal(report.data.todos[0].createdAt, 7)
    assert.equal(report.data.todos[0].updatedAt, 7)
})

test('a round trip through export and import preserves the data', () => {
    const file = buildExport(stored, { ...opts, includeDeviceData: true })
    const report = validateBackup(JSON.parse(JSON.stringify(file)), 'mine')
    assert.equal(report.error, undefined)
    assert.equal(report.schemaVersion, DATA_SCHEMA_VERSION)
    assert.equal(report.sameInstall, true, 'own backup is recognized as a restore, not a sync')
    assert.equal(report.data.todos[0].text, 'Task')
    assert.deepEqual(report.data['screentime:2026-09-14'].domains, { 'a.com': 60 })
})

test('a file from another install is flagged as such', () => {
    const file = buildExport(stored, { ...opts, installId: 'theirs', includeDeviceData: false })
    assert.equal(validateBackup(file, 'mine').sameInstall, false)
})

test('a corrupt file claiming to be ours is rejected, not treated as a flat dump', () => {
    assert.equal(readEnvelope({ app: EXPORT_APP_ID, data: 'nope' }), null)
    assert.ok(validateBackup({ app: EXPORT_APP_ID, schemaVersion: 1 }).error)
})

test('a file from a future schema imports what it can and says it was truncated', () => {
    const report = validateBackup({
        app: EXPORT_APP_ID, schemaVersion: DATA_SCHEMA_VERSION + 5, exportedAt: 1, data: { todos: [] },
    })
    assert.equal(report.error, undefined)
    assert.ok(report.skipped.some((s) => s.includes('newer version')))
})

test('merging keeps existing data and refuses to blend settings', () => {
    const existing = {
        settings: { theme: 'light' },
        todos: [{ id: 'a', text: 'Mine', done: false, pinned: false, createdAt: 1, updatedAt: 1 }],
        'screentime:2026-09-14': { totalSeconds: 10, domains: { 'a.com': 10 }, lastUpdated: 1 },
    }
    const incoming = {
        settings: { theme: 'dark' },
        todos: [{ id: 'b', text: 'Theirs', done: false, pinned: false, createdAt: 2, updatedAt: 2 }],
        'screentime:2026-09-14': { totalSeconds: 40, domains: { 'b.com': 40 }, lastUpdated: 3 },
    }
    const summary = mergeBackup(existing, incoming)
    assert.equal(summary.data.settings.theme, 'light', 'settings are replace-only')
    assert.ok(summary.held.some((h) => h.startsWith('settings')))
    assert.deepEqual(summary.data.todos.map((t) => t.text), ['Mine', 'Theirs'])
    assert.deepEqual(summary.data['screentime:2026-09-14'].domains, { 'a.com': 10, 'b.com': 40 })
    assert.ok(summary.changes.some((c) => c.startsWith('todos:')))
})

test('merging focus history appends without duplicating or resuming a session', () => {
    const existing = { focus: { session: { id: 'live' }, history: [{ id: 'h1', completedAt: 10 }] } }
    const incoming = { focus: { session: { id: 'theirs' }, history: [{ id: 'h1', completedAt: 10 }, { id: 'h2', completedAt: 20 }] } }
    const summary = mergeBackup(existing, incoming)
    assert.deepEqual(summary.data.focus.session, { id: 'live' }, 'the live session stays this device’s')
    assert.deepEqual(summary.data.focus.history.map((h) => h.id), ['h2', 'h1'])
})

test('an import stamps the current schema rather than adopting the file’s marker', () => {
    // Records are repaired to the current shape on the way in, so the payload is current by
    // construction; carrying an old marker would make the data migration re-walk it for nothing.
    const legacy = validateBackup({ todos: [{ id: 'a', text: 'Old', createdAt: 1 }], schemaVersion: 0 })
    assert.equal(legacy.data.schemaVersion, DATA_SCHEMA_VERSION)
    assert.ok(!legacy.skipped.some((s) => s.includes('schemaVersion')), 'a known key is not reported as unknown')
})

test('an install identity is never imported from a file', () => {
    const report = validateBackup({ todos: [], installId: 'theirs' })
    assert.ok(!('installId' in report.data))
    assert.ok(!report.skipped.some((s) => s.includes('installId')))
})
