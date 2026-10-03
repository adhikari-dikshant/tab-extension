import test from 'node:test'
import assert from 'node:assert/strict'
import { validateBackup, sanitizeSettings } from '../src/lib/backup.ts'
import { BENTO_WIDGET_IDS, DEFAULT_SETTINGS, WIDGET_IDS } from '../src/lib/storage.ts'

globalThis.crypto ??= (await import('node:crypto')).webcrypto

test('files with no Daily Workspace data are rejected before anything is written', () => {
    for (const input of [null, 42, 'text', [], {}, { unrelated: true }]) {
        const report = validateBackup(input)
        assert.ok(report.error, `expected ${JSON.stringify(input)} to be rejected`)
        assert.deepEqual(report.data, {})
    }
})

test('the documented crash vector is repaired rather than imported as-is', () => {
    // {"settings":{"cardOrder":null}} previously passed validation, wiped storage, and then
    // crashed the dashboard on the spread of a null cardOrder.
    const report = validateBackup({ settings: { cardOrder: null } })
    assert.equal(report.error, undefined)
    assert.deepEqual(report.data.settings.cardOrder, DEFAULT_SETTINGS.cardOrder)
    assert.deepEqual(report.data.settings.widgetsEnabled, DEFAULT_SETTINGS.widgetsEnabled)
})

test('every settings field is rebuilt from a known-good value, not trusted', () => {
    const hostile = sanitizeSettings({
        theme: 'neon', accentColor: 'javascript:alert(1)', opacity: 9000, searchEngine: 'askjeeves',
        clockFormat: 7, tempUnit: null, location: { lat: 'north' }, wallpaper: 'everywhere',
        widgetsEnabled: ['shortcuts', 'nonsense', 42], cardOrder: ['todo', 'todo', 'nope'],
        featuredCards: ['nope', 'todo', 'notes', 'weather'], greetingName: 'x'.repeat(500), customText: { nope: true },
        desktopReminders: 'yes',
    })
    assert.equal(hostile.theme, DEFAULT_SETTINGS.theme)
    assert.equal(hostile.accentColor, DEFAULT_SETTINGS.accentColor)
    assert.equal(hostile.opacity, 100)
    assert.equal(hostile.searchEngine, DEFAULT_SETTINGS.searchEngine)
    assert.equal(hostile.clockFormat, DEFAULT_SETTINGS.clockFormat)
    assert.equal(hostile.tempUnit, DEFAULT_SETTINGS.tempUnit)
    assert.equal(hostile.location, 'auto')
    assert.deepEqual(hostile.wallpaper, { type: 'none', value: null })
    // 'nonsense' and 42 are dropped; notes/workspaces arrive from the version-0 migration.
    assert.ok(hostile.widgetsEnabled.includes('shortcuts'))
    assert.ok(!hostile.widgetsEnabled.some((id) => !WIDGET_IDS.includes(id)))
    assert.deepEqual(hostile.cardOrder, ['todo', 'notes'])
    // Invalid ids are dropped and the pair is capped at two.
    assert.equal(hostile.featuredCards.length, 2)
    assert.ok(hostile.featuredCards.every((id) => BENTO_WIDGET_IDS.includes(id)))
    assert.equal(hostile.greetingName.length, 80)
    assert.equal(hostile.customText, '')
    assert.equal(hostile.desktopReminders, false)
})

test('unusable list entries are dropped and reported, valid ones kept', () => {
    const report = validateBackup({
        shortcuts: [
            { id: 'a', label: 'Good', url: 'https://example.com' },
            { id: 'b', label: 'Script', url: 'javascript:alert(1)' },
            { id: 'c', label: 'File', url: 'file:///etc/passwd' },
            'not an object',
        ],
        todos: [{ id: 'd', text: 'Real task', createdAt: 1 }, { id: 'e', text: '   ' }],
        workspaces: [{ id: 'f', name: 'Work', tabs: [{ url: 'https://example.com', title: 'E' }, { url: 'chrome://settings' }] }],
    })
    assert.equal(report.error, undefined)
    assert.deepEqual(report.data.shortcuts.map((s) => s.url), ['https://example.com'])
    assert.deepEqual(report.data.todos.map((t) => t.text), ['Real task'])
    assert.equal(report.data.workspaces[0].tabs.length, 1)
    assert.ok(report.accepted.includes('1 shortcuts'))
    assert.ok(report.skipped.some((s) => s.includes('3 unreadable shortcuts')))
})

test('unknown keys are reported and excluded from the payload', () => {
    const report = validateBackup({ todos: [], evil: { payload: 1 }, 'screentime:not-a-date': {} })
    assert.ok(!('evil' in report.data))
    assert.ok(!('screentime:not-a-date' in report.data))
    assert.ok(report.skipped.some((s) => s.includes('"evil"')))
})

test('screen-time days keep sane numbers and a restored focus session never resumes mid-flight', () => {
    const report = validateBackup({
        'screentime:2026-09-14': { totalSeconds: 120, domains: { 'example.com': 60, 'bad.com': -5, 'worse.com': 'lots' }, lastUpdated: 1 },
        focus: { session: { id: 's', status: 'running', endsAt: 1 }, history: [{ id: 'h', label: 'Deep work', minutes: 25, completedAt: 2 }] },
    })
    assert.deepEqual(report.data['screentime:2026-09-14'].domains, { 'example.com': 60 })
    assert.equal(report.data.focus.session, null)
    assert.equal(report.data.focus.history.length, 1)
})

test('the bubble choice travels with a backup and defaults to on', () => {
    assert.equal(sanitizeSettings({ overlayEnabled: false }).overlayEnabled, false)
    assert.equal(sanitizeSettings({ overlayEnabled: true }).overlayEnabled, true)
    assert.equal(sanitizeSettings({}).overlayEnabled, true)
    assert.equal(sanitizeSettings({ overlayEnabled: 'yes' }).overlayEnabled, true)
})

test('an old backup is brought forward to the current settings version on import', () => {
    const report = validateBackup({ settings: { widgetsEnabled: ['shortcuts', 'todo'], notesEnabled: false } })
    const settings = report.data.settings
    assert.equal(settings.settingsVersion, DEFAULT_SETTINGS.settingsVersion)
    assert.ok(!settings.widgetsEnabled.includes('notes'), 'the opt-out carries over')
    assert.ok(settings.widgetsEnabled.includes('workspaces'))
    assert.ok(!('notesEnabled' in settings))
})
