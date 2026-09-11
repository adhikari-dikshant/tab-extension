# New-tab dashboard — on-screen requirements

What needs to actually be present on screen, card by card, including states that are easy to forget until you hit them mid-build (empty, loading, error, first-run). This is the frontend counterpart to the backend spec — that doc says what data exists and how it's tracked; this one says what must be visible and interactable because of it.

---

## 1. Page-level (always present, not part of any one card)

- Greeting text (custom message or name) + current date
- Clock — must reflect the `12h`/`24h` setting live, not just on page load
- Command bar — always visible, always focusable via keyboard shortcut, with visible placeholder text hinting at prefixes (`t:`, `b:`) so the syntax isn't hidden knowledge
- Theme toggle — reachable without opening a settings modal; a persistent icon/control, not buried
- Bento grid of cards, responsive to window width (the extension has to look correct whether new-tab is in a full window or a narrow one)

**First-run requirement**: on first install, before any permissions are granted and before any data exists, the page must still render something coherent — not blank cards, not console errors. Each card needs a defined empty/first-run state (below), and any permission-gated card (weather's geolocation, bookmarks) needs to prompt for permission from within the card itself, not silently fail.

---

## 2. Search bar / command bar

- Input field, single line, expands focus ring or similar on focus
- Default behavior (no prefix): typed text goes to the selected search engine on Enter
- Prefix behaviors: `t:` adds a to-do, `b:` bookmarks, `@shortcut-name` jumps a shortcut — each needs a visible confirmation (brief toast or inline flash) so the user knows the action registered, since there's no page navigation to confirm it happened
- Search engine selector — small, doesn't dominate the bar, but must be visibly changeable (icon-based dropdown, matching MYNT's pattern of Google/DuckDuckGo/Bing/Brave/YouTube/Wikipedia/etc.)
- Voice input control (mic icon) if carried over from MYNT's feature set — optional for v1, but the input's layout should leave room for it rather than requiring a redesign later

---

## 3. Weather card

- Location label (city name or "auto")
- Current temperature, large/prominent
- Condition text (e.g. "Clear sky") and matching icon
- Feels-like temperature
- Humidity
- Max / min for the day
- Unit toggle (°C/°F) reachable without leaving the card
- **Empty/error state**: location permission not yet granted → a clear "enable location" prompt inside the card, not a blank card. API failure (offline, rate-limited) → a distinct "couldn't load weather" state, not stale data shown silently as if current

---

## 4. Shortcuts card

- Grid of icons, each with a label or tooltip on hover
- Preset/common shortcuts available by default (YouTube, Mail, etc. — matching MYNT's starter set)
- Add-shortcut affordance visible within the card (not only via the command bar)
- Edit/remove on existing shortcuts — some interaction (hover reveal, long-press, or small edit icon) that doesn't require a separate settings page
- **Empty state**: if a user removes all shortcuts, the card shouldn't collapse to nothing — show an "add your first shortcut" prompt

---

## 5. To-do card

- List of tasks, each with a checkbox and label
- Pin control per task (distinct visual marker for pinned vs unpinned)
- Add-task input inline in the card (in addition to the `t:` command bar shortcut)
- Completed tasks visually distinct (strikethrough/muted) until the daily reset clears them
- **Empty state**: "nothing on your list" prompt, not a blank card
- Consider a count/progress indicator (e.g. "2 of 5 done") if the list grows past what's visible at once

---

## 6. Bookmarks card / sidebar

- List or grid layout toggle (matches MYNT's list/grid switch)
- Favicon + title per bookmark
- Delete affordance per item
- Folder/organization if the bookmark tree has folders — at minimum, don't flatten a deeply nested tree into an unreadable single list; some grouping or a "show more" pattern
- **Permission requirement**: `bookmarks` permission prompt must be clear about why it's needed, shown at the point the card would otherwise be empty
- **Empty state**: no bookmarks yet → prompt explaining where bookmarks come from (browser's own bookmark bar), not just blank

---

## 7. Focus timer card

- Time remaining, large and legible at a glance (this card gets glanced at often, so treat it like the clock)
- Session label ("Deep work session" or user-set)
- Start / pause / reset controls, visible without opening anything
- Duration picker (25/5, 50/10, custom) — needs to be reachable but shouldn't clutter the compact card view; a small settings affordance within the card is enough
- Visual state difference between "running," "paused," and "idle/not started" — a static card that always looks the same regardless of state will feel broken
- Completion behavior: what happens on screen when a session ends (notification is backend-spec's job, but the card itself should visibly reflect "session complete" rather than silently resetting)

---

## 8. Screen-time card (collapsed + expanded)

**Collapsed** (default grid state):
- Total time today, one number, glanceable
- Segmented bar showing top domains by share of time — color-coded, no labels needed at this size
- Click/tap target opens the modal — the whole card should be interactive, not a tiny icon in the corner

**Expanded (modal)**:
- Today / Week toggle
- Total time + comparison vs previous period (e.g. "↓18% vs yesterday")
- Full segmented bar, same color coding as the collapsed view (consistency matters here — a domain's color shouldn't change between views)
- Ranked list of domains with icon, name, and time — top 4-5 explicit, remainder bucketed as "Other" (per backend spec §2.4/§3, don't let five 2-minute visits either get dropped or clutter the list)
- Close control (X or click-outside) that returns to the exact grid state it opened from

**Permission/first-use requirement**: since this needs `tabs`/`idle`, the very first time this card would render, it should show a clear opt-in explaining what's tracked and that it's local-only — not silently start tracking the moment the permission happens to be granted.

---

## 9. Google apps card

- Grid of icons (Gmail, Drive, Docs, Calendar, Photos, etc.), each opening the corresponding app in a new tab
- No configuration needed — static, but should still match the card sizing/style of every other card rather than looking like an afterthought

---

## 10. Background / wallpaper

- Not a bento card — this affects the whole page background, so it belongs in the theme/settings surface, not the grid
- Preset options visible as thumbnails, not just names
- Custom upload control
- "Daily random" toggle (MYNT sources this from Lorem Picsum) if carried over
- Currently-active wallpaper should be visually indicated among the choices

---

## 11. Modal (shared component used by screen-time and anything else that needs detail view)

- Dimmed backdrop over the grid, grid itself not interactive while modal is open
- Click-outside and Escape both close it
- Content area sized to what it's showing — don't force every modal to the same fixed dimensions if content varies
- Focus trap while open (keyboard tabbing shouldn't escape into the dimmed grid behind it) — easy to skip, matters a lot for the keyboard-first interaction goal from the project spec

---

## 12. Backup / restore

- Export control, clearly labeled, triggers a file download
- Import control, accepts a file, shows a confirmation before overwriting existing data (an import is destructive — silently replacing someone's shortcuts/to-dos/settings without confirmation is the kind of thing that generates angry reviews)
- "Last backed up" indicator if you want to nudge people to do it periodically — small text, not urgent-feeling

---

## 13. States that apply across every card (don't design one card at a time and forget these)

- **Loading**: first paint before storage has been read — skeleton or subtle placeholder, not a layout jump once data arrives
- **Empty**: no data yet (new install, or user cleared something) — each card's empty state is listed above; the common thread is none of them should look identical to "broken"
- **Error**: something failed (permission denied, API down, storage read failed) — distinct from empty, should say what went wrong in plain terms
- **Populated**: the normal case, already covered per card above