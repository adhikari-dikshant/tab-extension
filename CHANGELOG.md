# Changelog

All notable changes to Daily Workspace are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). While the version stays below `1.0.0`,
minor releases may still change how data is stored — each one documents what happens to your
existing data when you upgrade.

## [0.2.0] — 2026-10-03

Your tasks, notes and timer follow you onto the pages you're actually working on, and the dashboard
itself is rebalanced around the two cards people use most.

### Added

- **A bubble on other sites.** A collapsed handle on the left (or right) edge of any page, opening a
  compact tasks list or your pinned note — the same records as the dashboard, edited in place. At
  rest it is small, muted and nearly solid, so the page's text never shows through it, and it
  sharpens when you point at it. It sits *under* the site's own dialogs rather than over them,
  closes on `Esc` or any click outside, and can be hidden per-site from inside the panel. On by
  default, and one switch in Settings → Productivity turns it off everywhere. Tabs that are already
  open get it straight away, without a reload.
- **A floating focus timer**, top-right. Between sessions it is a faint timer icon: hover shows
  "Focus · 25 min", and one click starts a session. While a session runs it shows the remaining time
  as a quiet progress ring with pause/resume, and the session's name slides out only on hover.
- Both are absent on sign-in and checkout pages regardless of settings, hide while a page is
  fullscreen (videos, slides), and never appear on the new tab page, where the same things are
  already on screen as cards.
- **Two cards can now be given double height** instead of one. In the layout editor each card has a
  height toggle; pick any two.
- **Save a most-visited site as a shortcut.** Point at a site and press **+**; it turns into a check
  once the site is in your shortcuts, and stays a check for sites already there.
- **A day-progress bar** beneath the date shows how much of today has gone.

### Changed

- **To-do and Notes are the large cards by default**, side by side, with the compact cards arranged
  around them. If you had chosen a different card to enlarge, it is kept as one of the two.
- **The date and temperature moved into the welcome strip**, beside a larger clock. They answer the
  same question — what today is like — so they now sit together in the place that already held the
  other "right now" facts: the date under the time, and the temperature alongside it with an icon
  tinted by the sky (sun, cloud, rain, snow, storm) above the button that starts a focus session. The
  Weather card is gone from the grid; the grid below is entirely things you act on. Conditions,
  feels-like, the high/low and your location are in the reading's tooltip, and clicking the
  temperature still switches °C/°F.
- **Most visited fits the shape of its card.** A wide card shows one row of icon tiles, a medium one
  a two-column list, and a narrow one a single list with each site's domain — so the full-width
  strip at the bottom of the default layout shows all your sites instead of one and a half. Sites
  are now ordinary links, so middle-click opens one in a new tab.
- **Calmer, more consistent motion.** Controls give slightly when pressed and settle back with a
  small spring; cards answer the pointer with their edge and shadow rather than moving; checking off
  a task pops; focus rings draw in instead of snapping on; and a new tab settles in top to bottom in
  well under a second. The bubble's panel slides out from the edge it is docked to. All of it is off
  when your system asks for reduced motion.
- **A new icon** for the extension, in the toolbar and on the extensions page.
- **Screen time shows everything on the card.** The full per-site breakdown with durations, the
  day/week toggle and the comparison against yesterday are all visible without tapping through; the
  detail dialog is gone and the card is shorter.
- Card placement is now computed from which cards are chosen rather than from their position in the
  grid, so reordering no longer moves the emphasis to whatever card lands in a given slot.

### Upgrading from 0.1.0

- **Your layout is migrated.** The single enlarged card becomes the first of a pair; the second is
  filled from the defaults so you never land on a half-set layout. Weather is removed from the card
  order so no cell is reserved for it, while its switch is kept — turning it off still hides the
  temperature, it just lives in the strip now.
- **One new permission, and Chrome will ask you to approve it.** Access to the pages you visit
  (shown as "Read and change all your data on all websites") is what lets the bubble appear there.
  Chrome disables the extension after this update until you accept it from the extensions menu. The
  bubble only renders your own tasks and notes: nothing on those pages is read or sent anywhere.
- **The bubble is on once you accept.** Turn it off in Settings → Productivity, or restrict site
  access from Chrome's extension settings; either removes it from every page. A backup carries your
  choice, so importing one with the bubble switched off keeps it off.

## [0.1.0] — 2026-10-03

A local-first data model and keyboard capture. Your tasks, notes and links are now versioned
records that can move between browser profiles without duplicating, and you can save the page
you're on without leaving it.

### Added

- **Capture from any page.** Four browser-wide shortcuts, remappable at
  `chrome://extensions/shortcuts`:
  - `Alt Shift T` — save the current page as a task
  - `Alt Shift N` — save your text selection, or just the page, as a note
  - `Alt Shift L` — save the current page as a shortcut
  - `Alt Shift K` — open the dashboard with search focused
- **Source links.** Anything captured from a page records where it came from, and links back to it.
- **Search covers your own tasks and notes**, not just tabs, bookmarks and shortcuts. Picking a task
  jumps to it in the To-do card and highlights it; picking a note opens it.
- **Merge on import.** Importing a backup now offers *Merge* alongside *Replace*. Merge keeps what
  you have and updates a task, note or link only when the file's copy is genuinely newer, matching on
  content so the same record carried between two browser profiles updates in place instead of
  appearing twice.
- **Self-describing exports.** A backup file now records its schema version, when it was made, and
  which installation made it, so a future version knows how to read it.
- **Storage tiers.** Screen-time history is recognised as describing one machine: it is left out of
  an export unless you tick the box, and never merged in from another device. Caches are never
  exported at all.
- **Saved workspaces** has its own sidebar panel and settings toggle, instead of being a hidden tab
  inside the Recent panel.

### Changed

- Tasks, notes, links and workspaces all carry creation and modification times now. This is what
  lets a merge tell which copy of a record is newer.
- The **Quick notes** switch moved from its own setting into the ordinary widget toggles. Your
  existing choice is carried over — if you had notes switched off, it stays off.
- Backups are now described before you confirm: the dialog lists exactly what will be written, what
  was skipped, and which device the file came from.

### Fixed

- **Importing a malformed backup could erase your data.** A file only needed to be valid JSON to be
  accepted; it was then written after storage had already been cleared, and a value of the wrong type
  could leave the dashboard unable to render. Backups are now validated field by field *before*
  anything is deleted, a file with no recognisable data is refused outright, and a failed write rolls
  back to what you had.
- The Firefox build no longer declares that the extension collects no data. It now names the three
  features that contact a third party — weather, search suggestions, and the site-icon fallback —
  matching what the README has always described.

### Upgrading from 0.0.1

- **No action needed, and nothing is lost.** The first time you open a new tab after updating, your
  existing tasks, notes and shortcuts are brought up to the new format in place. Records that had no
  timestamp are dated conservatively rather than marked as just-edited, so nothing is reordered.
- **Backups you already have still work.** Files exported by 0.0.1 have no version wrapper; they are
  recognised and imported as before.
- **Two new permissions, no prompt.** `activeTab` and `scripting` power keyboard capture. Neither
  triggers a browser warning, so the update installs without asking you to re-approve anything.
  `activeTab` is granted by the capture keypress itself — the extension gets no standing access to
  your tabs, and reads nothing until you ask it to.

## [0.0.1] — 2026-09-13

Initial version: bento dashboard with shortcuts, to-dos, notes, weather, screen time and most-visited
cards; an icon rail of side panels; search with suggestions, voice input and `t:` / `b:` / `@`
commands; a focus timer; themes, accents, wallpapers; and manual backup and restore.

[0.2.0]: https://github.com/adhikari-dikshant/tab-extension/releases/tag/v0.2.0
[0.1.0]: https://github.com/adhikari-dikshant/tab-extension/releases/tag/v0.1.0
[0.0.1]: https://github.com/adhikari-dikshant/tab-extension/releases/tag/v0.0.1
