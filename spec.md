# New-tab dashboard — backend functionality spec

Scope: everything that isn't rendering. Storage schemas, service-worker logic, permissions, and the APIs each feature depends on. Frontend (components, layout, modal/popover interaction) is intentionally out of scope here — this doc assumes whatever UI consumes these data shapes.

Stack assumption: Manifest V3, `chrome.storage.local` as the only persistence layer, no external server. Everything runs client-side in the browser — "backend" here means the service worker + storage layer, not a hosted API.

---

## 1. Permissions inventory

| Permission | Needed for | Notes |
|---|---|---|
| `storage` | everything | local persistence, ~10MB quota (unlimited with `unlimitedStorage`) |
| `tabs` | screen-time tracking | broader than `activeTab` — required to read URL on every tab, not just the one the user clicks into |
| `idle` | screen-time accuracy | detects away-from-keyboard so idle time isn't counted as usage |
| `bookmarks` | bookmarks widget | read (and optionally delete) the user's bookmark tree |
| `alarms` | daily reset (to-dos, streaks), periodic wallpaper rotation | MV3 service workers die when idle — `alarms` is the only reliable way to wake up on a schedule |
| `notifications` | focus timer completion | optional, but the timer is close to useless without an end-of-session ping |
| `geolocation` *(web API, not manifest perm)* | weather, "usage timing" if you ever localize insights | requested at runtime, not declared in manifest |
| `downloads` *(only if wallpaper upload writes to disk)* | custom wallpaper | likely unnecessary — wallpapers can stay as blobs in storage/IndexedDB |

Flag for later: `tabs` is a meaningfully bigger permission ask than MYNT's current footprint. Worth deciding whether screen-time tracking ships in v1 or v2 — it changes your store-listing trust story either way.

---

## 2. Storage schema

All keys live under `chrome.storage.local`. Suggested namespacing so nothing collides and backup/restore can serialize cleanly:

```
settings:*        → user preferences (theme, search engine, units, etc.)
shortcuts          → array
todos              → array
bookmarks_cache    → optional cache of chrome.bookmarks tree, if you don't hit the live API each render
screentime:{date}  → per-day usage object, date = "2026-09-10"
focus:sessions     → array of completed sessions (for history/streaks)
focus:active       → current running session, or null
weather:cache      → last fetched result + timestamp
backup:lastExport  → timestamp only, for showing "last backed up X ago"
```

### 2.1 Settings

```ts
settings: {
  theme: "floral-dark" | "floral-light" | ...custom,
  searchEngine: "google" | "duckduckgo" | "bing" | "brave" | "youtube" | "wikipedia",
  greetingName: string,
  clockFormat: "12h" | "24h",
  tempUnit: "celsius" | "fahrenheit",
  location: { lat: number, lon: number, label: string } | "auto",
  wallpaper: { type: "upload" | "daily-random" | "none", value: string | null },
  widgetsEnabled: string[],       // which bento cards are on, and in what order
  language: string                // i18n code
}
```

### 2.2 Shortcuts

```ts
shortcuts: {
  id: string,
  label: string,
  url: string,
  icon: string        // favicon url or bundled icon name
}[]
```

### 2.3 To-dos

```ts
todos: {
  id: string,
  text: string,
  done: boolean,
  pinned: boolean,
  createdAt: number
}[]
```
Reset rule (matches MYNT's behavior, worth keeping): at the start of each day, non-pinned completed items clear; pinned items reset to `done: false` rather than being deleted. Implemented via a daily `alarms` trigger, not a `setTimeout` — the service worker won't stay alive long enough for a timeout to fire reliably.

### 2.4 Screen time

```ts
"screentime:2026-09-10": {
  totalSeconds: number,
  domains: {
    "github.com": number,     // seconds, active-focus time only
    "youtube.com": number,
    ...
  },
  lastUpdated: number
}
```
One key per calendar day (local time, not UTC — rollover should match when the user's day actually ends). Weekly/monthly views are computed at read time by summing the last N day-keys, not stored as a separate rollup — keeps the write path simple and avoids double-bookkeeping.

### 2.5 Focus timer

```ts
"focus:active": {
  startedAt: number,
  durationSeconds: number,
  label: string
} | null

"focus:sessions": {
  startedAt: number,
  completedAt: number,
  durationSeconds: number,
  label: string
}[]
```

---

## 3. Screen-time tracking logic

This is the one genuinely nontrivial background system — everything else is closer to CRUD. Core idea: track one "active interval" at a time, close it out and open a new one whenever focus changes.

**State to hold in the service worker (in-memory, not storage — storage is for completed intervals only):**
```ts
let currentDomain: string | null = null;
let intervalStart: number | null = null;
```

**Events that must close the current interval and (maybe) open a new one:**
- `chrome.tabs.onActivated` — user switched tabs
- `chrome.tabs.onUpdated` (when `changeInfo.url` changes on the active tab) — navigated within the same tab
- `chrome.windows.onFocusChanged` — switched to a different browser window, or left the browser entirely (`windowId === chrome.windows.WINDOW_ID_NONE`)
- `chrome.idle.onStateChanged` — user went idle or locked the screen

**On any of the above:**
1. If `currentDomain` and `intervalStart` are set, compute elapsed seconds and add them to `screentime:{today}.domains[currentDomain]`.
2. If the trigger was idle/away/no-window, set `currentDomain = null` — don't start a new interval.
3. Otherwise, resolve the new active tab's domain and set `currentDomain` / `intervalStart = Date.now()`.

**Edge cases worth deciding now, not discovering later:**
- **Multiple windows open simultaneously** — only the focused window's active tab counts. Background windows accrue nothing.
- **Incognito** — screen time should not track incognito tabs at all unless the extension is explicitly enabled there (off by default, matches user expectation).
- **Midnight rollover mid-session** — if an interval is still open when the date changes, split it: credit the portion before midnight to yesterday's key, start a fresh interval for today.
- **Service worker termination** — MV3 workers can be killed and restarted anytime. `intervalStart` living in memory means a killed worker loses the current in-progress interval. Mitigate by periodically flushing (every ~30s via `alarms`) rather than only flushing on event boundaries — worst case you lose <30s, not the whole session.
- **Domain normalization** — strip `www.`, ignore subdomains vs not (`docs.google.com` vs `google.com`) is a real product decision, not just parsing. Recommend: track by registrable domain (`google.com`), not full hostname, unless you want Drive/Gmail/Calendar broken out separately — in which case track by hostname and merge in the UI layer.

---

## 4. Weather

- Any free-tier weather API works (Open-Meteo requires no key and is a reasonable default; OpenWeatherMap if you want more detail like "feels like").
- Cache the response (`weather:cache`) with a timestamp; refetch only if >15-20 min old or location changed. Don't fetch on every new-tab open — that's a network call on every keystroke of browsing, which is both wasteful and slow.
- Location: prefer the `geolocation` web API (user grants once), fall back to manual city entry if denied. Don't silently default to IP-based geolocation — that's a trust issue for an extension that's positioning itself as privacy-first.

---

## 5. Bookmarks & Google apps

- Bookmarks: read via `chrome.bookmarks.getTree()` live each time the widget renders, or cache with an `onCreated`/`onRemoved`/`onChanged` listener to keep it in sync — caching avoids re-walking a large bookmark tree on every render but adds sync complexity. For a v1, live read is simpler and fast enough unless someone has thousands of bookmarks.
- Google apps: static list, no API needed — these are just fixed deep links (mail.google.com, drive.google.com, etc.), no permission required beyond opening a URL.

---

## 6. Backup & restore

- Export: serialize every namespaced key above into one JSON blob, trigger a download via a data URL (no `downloads` permission needed for a simple `<a download>` click).
- Import: parse, validate shape (don't trust the file blindly — a malformed import shouldn't corrupt live storage), then `chrome.storage.local.set()` in one batch.
- This is also your de facto sync mechanism until/unless you build real cross-device sync — worth documenting clearly for users so "backup" isn't mistaken for "auto-sync."

---

## 7. What I'd actually cut for v1

Given the full list, here's what's essential vs what can wait, in my opinion:

**Ship in v1 (core loop, each is low-complexity and high-visibility):**
- Search bar + engine switching
- Clock + greeting
- Shortcuts
- To-do (with the daily reset logic)
- Bookmarks
- Theme toggle (even if only 2 theme presets initially)
- Backup/restore (cheap to build, prevents "I lost my setup" complaints early)

**Ship in v1.1, once the core loop is solid:**
- Weather (external dependency, needs its own error/offline handling)
- Google apps (trivial, but not urgent — static links)
- Focus timer (self-contained, doesn't depend on anything else)

**Ship last, treat as its own mini-project:**
- Screen-time tracking — it's the only feature here that needs a genuinely stateful background system, a bigger permission ask, and its own UI surface (the expanded/modal view). Bolting it onto an otherwise-simple v1 risks the whole release slipping on the hardest feature. Land everything else, get it in people's hands, then build this as a clearly-scoped v2.

---

## 8. Open decisions before writing code

- Domain granularity for screen time (registrable domain vs full hostname) — section 3.
- Weather API choice and whether "feels like / humidity / max-min" (from your notes) needs a provider beyond Open-Meteo's free tier.
- Whether custom wallpaper upload stores in `chrome.storage.local` (small, quota-limited) or `IndexedDB` (larger, better for images) — recommend IndexedDB the moment you support uploaded images rather than only presets.