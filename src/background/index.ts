import './productivity'
import { changeStored } from '../lib/productivity'
import { dateKey, normalizeDomain, storageKeyForDate, type ScreenTimeDay } from '../lib/screentime'

const DAILY_RESET_ALARM = 'daily-reset'
const SCREEN_TIME_FLUSH_ALARM = 'screen-time-flush'

// ---------- Daily reset (todos: non-pinned completed items clear, pinned items un-check) ----------

function scheduleDailyReset() {
    const next = new Date()
    next.setHours(24, 0, 5, 0) // just after local midnight
    chrome.alarms.create(DAILY_RESET_ALARM, { when: next.getTime(), periodInMinutes: 24 * 60 })
}

async function runDailyReset() {
    await changeStored('todos', [], (list) => list
        .filter((todo) => (todo.repeat && todo.repeat !== 'none') || todo.pinned || !todo.done)
        .map((todo) => todo.pinned && !todo.dueDate && (!todo.repeat || todo.repeat === 'none') ? { ...todo, done: false } : todo))
}

chrome.runtime.onInstalled.addListener(() => {
    scheduleDailyReset()
    chrome.alarms.create(SCREEN_TIME_FLUSH_ALARM, { periodInMinutes: 0.5 })
})
chrome.runtime.onStartup.addListener(scheduleDailyReset)

// ---------- Screen-time tracking ----------
// One active interval at a time. Listeners only get wired once the optional tabs+idle
// permissions are actually granted (referencing chrome.idle.* before that throws).

let currentDomain: string | null = null
let intervalStart: number | null = null
let screenTimeWired = false

async function addSeconds(domain: string, date: Date, seconds: number) {
    if (seconds <= 0) return
    const key = storageKeyForDate(date)
    const result = await chrome.storage.local.get(key)
    const day: ScreenTimeDay = (result[key] as ScreenTimeDay | undefined) ?? {
        totalSeconds: 0,
        domains: {},
        lastUpdated: 0,
    }
    day.totalSeconds += seconds
    day.domains[domain] = (day.domains[domain] ?? 0) + seconds
    day.lastUpdated = Date.now()
    await chrome.storage.local.set({ [key]: day })
}

async function creditInterval(domain: string, start: number, end: number) {
    const startDate = new Date(start)
    const endDate = new Date(end)

    if (dateKey(startDate) !== dateKey(endDate)) {
        const midnight = new Date(endDate)
        midnight.setHours(0, 0, 0, 0)
        await addSeconds(domain, startDate, (midnight.getTime() - start) / 1000)
        await addSeconds(domain, endDate, (end - midnight.getTime()) / 1000)
        return
    }
    await addSeconds(domain, startDate, (end - start) / 1000)
}

async function closeInterval() {
    if (currentDomain === null || intervalStart === null) return
    const domain = currentDomain
    const start = intervalStart
    intervalStart = null
    await creditInterval(domain, start, Date.now())
}

async function setActiveDomainFromTab(tabId: number, windowId: number) {
    await closeInterval()

    try {
        const win = await chrome.windows.get(windowId)
        if (win.focused === false) {
            currentDomain = null
            return
        }
    } catch {
        currentDomain = null
        return
    }

    let tab: chrome.tabs.Tab
    try {
        tab = await chrome.tabs.get(tabId)
    } catch {
        currentDomain = null
        return
    }

    if (tab.incognito) {
        currentDomain = null
        return
    }

    const domain = tab.url ? normalizeDomain(tab.url) : null
    if (!domain) {
        currentDomain = null
        return
    }

    currentDomain = domain
    intervalStart = Date.now()
}

function onTabActivated({ tabId, windowId }: chrome.tabs.OnActivatedInfo) {
    void setActiveDomainFromTab(tabId, windowId)
}

function onTabUpdated(_tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) {
    if (!changeInfo.url || !tab.active || tab.id === undefined || tab.windowId === undefined) return
    void setActiveDomainFromTab(tab.id, tab.windowId)
}

async function onWindowFocusChanged(windowId: number) {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        await closeInterval()
        currentDomain = null
        return
    }
    const [tab] = await chrome.tabs.query({ active: true, windowId })
    if (tab?.id !== undefined) void setActiveDomainFromTab(tab.id, windowId)
}

async function onIdleStateChanged(state: 'active' | 'idle' | 'locked') {
    if (state !== 'active') {
        await closeInterval()
        currentDomain = null
        return
    }
    const focused = await chrome.windows.getLastFocused({})
    if (focused.focused && focused.id !== undefined) {
        const [tab] = await chrome.tabs.query({ active: true, windowId: focused.id })
        if (tab?.id !== undefined) void setActiveDomainFromTab(tab.id, focused.id)
    }
}

function wireScreenTimeListeners() {
    if (screenTimeWired) return
    screenTimeWired = true
    chrome.tabs.onActivated.addListener(onTabActivated)
    chrome.tabs.onUpdated.addListener(onTabUpdated)
    chrome.windows.onFocusChanged.addListener(onWindowFocusChanged)
    chrome.idle.onStateChanged.addListener(onIdleStateChanged)
    chrome.idle.setDetectionInterval(60)
}

chrome.permissions.contains({ permissions: ['tabs', 'idle'] }, (granted) => {
    if (granted) wireScreenTimeListeners()
})

chrome.permissions.onAdded.addListener((delta) => {
    if (!delta.permissions?.includes('tabs') && !delta.permissions?.includes('idle')) return
    chrome.permissions.contains({ permissions: ['tabs', 'idle'] }, (granted) => {
        if (granted) wireScreenTimeListeners()
    })
})

// ---------- Wiring ----------

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === DAILY_RESET_ALARM) {
        void runDailyReset()
    } else if (alarm.name === SCREEN_TIME_FLUSH_ALARM) {
        if (currentDomain && intervalStart) {
            const domain = currentDomain
            const start = intervalStart
            const now = Date.now()
            intervalStart = now
            void creditInterval(domain, start, now)
        }
    }
})
