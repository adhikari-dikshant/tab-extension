import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const wait = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)) }

test('service worker recovers focus expiry, reschedules pause/resume, and sends due reminders once', async () => {
    const OriginalDate = Date
    const now = new OriginalDate(2026, 8, 13, 10, 0).getTime()
    globalThis.Date = class extends OriginalDate {
        constructor(...args) { super(...(args.length ? args : [now])) }
        static now() { return now }
    }
    const store = {
        settings: { desktopReminders: true },
        focus: { session: { id: 'recovered', label: 'Read', mode: 'focus', durationMs: 60000, remainingMs: 60000, endsAt: now - 1000, status: 'running' }, history: [] },
        todos: [],
    }
    const alarmListeners = [], storageListeners = [], notifications = [], alarms = new Map(), locks = new Map()
    let permitted = true
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request(name, callback) {
        const next = (locks.get(name) || Promise.resolve()).then(callback); locks.set(name, next.catch(() => {})); return next
    } } } })
    const set = async (values) => {
        const changes = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { oldValue: structuredClone(store[key]), newValue: structuredClone(value) }]))
        Object.assign(store, structuredClone(values)); storageListeners.forEach(listener => listener(changes, 'local'))
    }
    globalThis.chrome = {
        runtime: { getURL: path => `chrome-extension://test/${path}` },
        storage: { local: { get: async key => ({ [key]: structuredClone(store[key]) }), set }, onChanged: { addListener: listener => storageListeners.push(listener) } },
        permissions: { contains: async () => permitted },
        notifications: { create: async (id, options) => { notifications.push({ id, ...options }); return id } },
        alarms: { create: (name, options) => alarms.set(name, options), clear: async name => alarms.delete(name), onAlarm: { addListener: listener => alarmListeners.push(listener) } },
    }
    const source = readFileSync(new URL('../src/background/productivity.ts', import.meta.url), 'utf8')
        .replace("'../lib/productivity'", JSON.stringify(new URL('../src/lib/productivity.ts', import.meta.url).href))
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    try {
        await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
        await wait()
        assert.equal(store.focus.session.status, 'finished'); assert.equal(store.focus.history.length, 1); assert.equal(notifications.length, 1)
        alarmListeners.forEach(listener => listener({ name: 'focus-session-end' })); await wait()
        assert.equal(store.focus.history.length, 1); assert.equal(notifications.length, 1)
        await set({ focus: { ...store.focus, session: { ...store.focus.session, id: 'running', status: 'running', endsAt: now + 60000 } } }); await wait()
        assert.equal(alarms.get('focus-session-end').when, now + 60000)
        await set({ focus: { ...store.focus, session: { ...store.focus.session, status: 'paused', endsAt: null } } }); await wait()
        assert.equal(alarms.has('focus-session-end'), false)
        store.todos = [{ id: 'due', text: 'Review project', done: false, dueDate: '2026-09-13' }, { id: 'future', text: 'Later', done: false, dueDate: '2026-09-14' }]
        alarmListeners.forEach(listener => listener({ name: 'task-reminders' })); await wait()
        assert.equal(notifications.length, 2); assert.equal(notifications[1].message, 'Review project')
        alarmListeners.forEach(listener => listener({ name: 'task-reminders' })); await wait(); assert.equal(notifications.length, 2)
        permitted = false; store.todos.push({ id: 'denied', text: 'No permission', done: false, dueDate: '2026-09-13' })
        alarmListeners.forEach(listener => listener({ name: 'task-reminders' })); await wait(); assert.equal(notifications.length, 2); assert.equal(store.todos[2].reminderFor, undefined)
    } finally { globalThis.Date = OriginalDate }
})
