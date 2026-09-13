import test from 'node:test'
import assert from 'node:assert/strict'
import { completeTodo, nextOccurrence, localDate, safeWebUrl, startFocus, settleFocus, EMPTY_FOCUS, changeStored } from '../src/lib/productivity.ts'

const stored = {}
const locks = new Map()
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request(name, callback) {
    const next = (locks.get(name) || Promise.resolve()).then(callback)
    locks.set(name, next.catch(() => {}))
    return next
} } } })
globalThis.chrome = { storage: { local: {
    async get(key) { return structuredClone({ [key]: stored[key] }) },
    async set(values) { Object.assign(stored, structuredClone(values)) },
} } }

test('daily and weekly recurrence preserve local calendar dates across months and missed occurrences', () => {
    assert.equal(nextOccurrence('2024-02-28', 'daily', new Date(2024, 1, 28)), '2024-02-29')
    assert.equal(nextOccurrence('2026-12-31', 'daily', new Date(2026, 11, 31)), '2027-01-01')
    assert.equal(nextOccurrence('2026-09-01', 'weekly', new Date(2026, 8, 13)), '2026-09-15')
    assert.equal(nextOccurrence('2026-09-01', 'daily', new Date(2026, 8, 13)), '2026-09-14')
    assert.equal(localDate(new Date(2026, 8, 13, 23, 59)), '2026-09-13')
})

test('completing recurring tasks schedules the next occurrence without losing task fields', () => {
    const original = { id: 'a', text: 'Weekly review', done: false, pinned: true, createdAt: 0, repeat: 'weekly', dueDate: '2026-09-13' }
    const next = completeTodo(original, new Date(2026, 8, 13, 10))
    assert.equal(next.dueDate, '2026-09-20'); assert.equal(next.done, false); assert.equal(next.completedCount, 1); assert.equal(next.pinned, true)
    assert.equal(original.dueDate, '2026-09-13')
    assert.equal(completeTodo({ ...original, repeat: 'none' }).done, true)
})

test('concurrent changes preserve all additions across shared storage', async () => {
    stored.notes = []
    await Promise.all(Array.from({ length: 30 }, (_, index) => changeStored('notes', [], (items) => [...items, { id: `${index}` }])))
    assert.equal(stored.notes.length, 30)
})

test('a running focus session cannot be replaced; expiry is recorded exactly once across tabs', async () => {
    stored.focus = structuredClone(EMPTY_FOCUS)
    await startFocus(25, { id: 'task-a', text: 'Read' })
    const id = stored.focus.session.id
    await startFocus(10, { id: 'task-b', text: 'Write' })
    assert.equal(stored.focus.session.id, id)
    const end = stored.focus.session.endsAt
    await settleFocus(end - 1); assert.equal(stored.focus.history.length, 0)
    await Promise.all([settleFocus(end), settleFocus(end + 1000), settleFocus(end + 2000)])
    assert.equal(stored.focus.history.length, 1); assert.equal(stored.focus.history[0].minutes, 25); assert.equal(stored.focus.session.status, 'finished')
    await startFocus(5, undefined, 'break')
    await settleFocus(stored.focus.session.endsAt)
    assert.equal(stored.focus.history.length, 1)
})

test('paused focus sessions are not completed by elapsed wall time', async () => {
    stored.focus = structuredClone(EMPTY_FOCUS)
    await startFocus(25)
    stored.focus.session.status = 'paused'; stored.focus.session.endsAt = null
    await settleFocus(Date.now() + 10000000)
    assert.equal(stored.focus.session.status, 'paused'); assert.equal(stored.focus.history.length, 0)
})

test('workspace URLs accept web pages and reject scripts, browser settings, and files', () => {
    for (const url of ['https://example.com/a', 'http://localhost:3000']) assert.equal(safeWebUrl(url), true)
    for (const url of ['javascript:alert(1)', 'chrome://settings', 'file:///private/file', 'data:text/html,test', 'not a url']) assert.equal(safeWebUrl(url), false)
})
