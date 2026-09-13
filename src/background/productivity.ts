import { changeStored, FOCUS_ALARM, localDate, settleFocus } from '../lib/productivity'
import type { FocusState, Settings, Todo } from '../lib/storage'

const REMINDERS_ALARM = 'task-reminders'

async function notify(id: string, title: string, message: string) {
    const { settings } = await chrome.storage.local.get('settings')
    if (!(settings as Settings | undefined)?.desktopReminders) return
    const granted = await chrome.permissions.contains({ permissions: ['notifications'] })
    if (!granted) return
    await chrome.notifications.create(id, { type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon128.png'), title, message })
}

async function syncFocusAlarm() {
    await navigator.locks.request('dashboard:focus-alarm', async () => {
        const { focus } = await chrome.storage.local.get('focus')
        const session = (focus as FocusState | undefined)?.session
        if (session?.status === 'running' && session.endsAt) {
            if (session.endsAt <= Date.now()) await settleFocus()
            else chrome.alarms.create(FOCUS_ALARM, { when: session.endsAt })
        } else await chrome.alarms.clear(FOCUS_ALARM)
    })
}

async function remindDueTasks() {
    const now = new Date()
    if (now.getHours() < 9) return
    const { settings } = await chrome.storage.local.get('settings')
    if (!(settings as Settings | undefined)?.desktopReminders) return
    if (!await chrome.permissions.contains({ permissions: ['notifications'] })) return
    const today = localDate(now)
    const due: Todo[] = []
    await changeStored('todos', [], (items) => items.map((todo) => {
        if (todo.done || !todo.dueDate || todo.dueDate > today || todo.reminderFor === todo.dueDate) return todo
        due.push(todo)
        return { ...todo, reminderFor: todo.dueDate }
    }))
    if (due.length) await notify(`tasks-${today}`, `${due.length} task${due.length === 1 ? '' : 's'} due`, due.slice(0, 3).map((todo) => todo.text).join('\n'))
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.focus) return
    void syncFocusAlarm()
    const next = changes.focus.newValue as FocusState | undefined
    const previous = changes.focus.oldValue as FocusState | undefined
    if (next?.session?.status === 'finished' && (previous?.session?.id !== next.session.id || previous.session.status !== 'finished')) {
        void notify(`focus-${next.session.id}`, next.session.mode === 'break' ? 'Break complete' : 'Focus complete', next.session.mode === 'break' ? 'Ready for your next session?' : `Finished: ${next.session.label}. Take a moment for a break.`)
    }
})

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === FOCUS_ALARM) void settleFocus()
    if (alarm.name === REMINDERS_ALARM) void remindDueTasks()
})

// Recreate alarms from persisted timestamps after service-worker or browser restarts.
void syncFocusAlarm()
chrome.alarms.create(REMINDERS_ALARM, { periodInMinutes: 1 })
void remindDueTasks()

