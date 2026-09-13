<h1 align="center">Daily Workspace</h1>
<p align="center"><em>A calm, all-in-one New Tab dashboard for Chromium browsers.</em></p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss&logoColor=white">
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-4285f4?logo=googlechrome&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/License-GPL--3.0-blue.svg">
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-development">Development</a> •
  <a href="#-permissions">Permissions</a> •
  <a href="#-privacy">Privacy</a> •
  <a href="#-contributing">Contributing</a> •
  <a href="#-license">License</a>
</p>

<p align="center">
  <img src="public/bento-light.png" alt="Daily Workspace — light theme" width="49%">
  <img src="public/bento-dark.png" alt="Daily Workspace — dark theme" width="49%">
</p>

Daily Workspace replaces the browser's New Tab page with a single, organized home base: a bento-style dashboard of shortcuts, tasks, notes, weather, and screen time, reached through a compact icon rail and quick keyboard-driven search — all backed by local storage only.

## ✨ Features

### Dashboard cards
- **Shortcuts** — a personal launchpad of pinned links with favicons.
- **To-do** — quick add, due dates, daily/weekly repeat, pinning, and filters (All / Today / Completed). Deletions and completions can be undone from a toast.
- **Notes** — autosaving quick notes with pinning, opened from the dashboard card or the sidebar panel.
- **Weather** — live conditions, humidity, "feels like", and high/low, in °C or °F, for a location you set.
- **Screen time** — a private, local-only breakdown of time spent per site today or over the past week.
- **Most visited** — your top sites, surfaced automatically, one click from becoming a shortcut.
- **Dashboard layout editing** — drag cards (or use the keyboard) to reorder them, and choose a wider or full-height column to fit six or five cards.

### Quick access sidebar
An icon rail along the left edge opens focused side panels without leaving the dashboard:

<p align="center">
  <img src="public/offcanvas-apps.png" alt="Google Apps panel" width="32%">
  <img src="public/offcanvas-ai-tools.png" alt="AI tools panel" width="32%">
  <img src="public/offcanvas-settings.png" alt="Settings panel" width="32%">
</p>

- **Bookmarks** — browse and manage your bookmarks in list or grid layout.
- **Apps** — one-click access to Gmail, Drive, Calendar, Maps, and other Google services.
- **AI tools** — shortcuts to ChatGPT, Gemini, Claude, Perplexity, and more, fully editable.
- **Notes** — the full notes list, editable in place.
- **Recent** — reopen recently closed tabs, and save/restore whole browsing sessions as named **workspaces**.
- **Customize** — every setting below, without ever leaving the new tab page.

### Search & quick commands
- One search bar for Google, DuckDuckGo, Bing, Brave Search, YouTube, or Wikipedia, with search suggestions and voice input.
- Type `@` to jump to a shortcut, `t:` to add a to-do, or `b:` to search bookmarks — all without leaving the search bar.
- `⌘K` / `Ctrl K` or `/` focuses search from anywhere on the page.

### Focus
- A lightweight focus timer next to the clock, optionally linked to a specific task, with pause/resume, breaks, and a session history that survives browser restarts.

### Personalization
- Light, dark, or browser-matched theme; a nine-color accent palette plus a custom color picker that tints cards, highlights, and controls.
- Upload your own wallpaper (or shuffle a random one), with an interface opacity slider.
- Digital or analog clock, 12/24-hour format, a custom greeting or message, and a daily motivational quote.
- Toggle every card and sidebar section on or off independently.

### Backup & reset
- Export or import your entire setup as a file, or reset everything back to defaults, from Settings → Data.

## 📸 More screenshots

<p align="center">
  <img src="artifacts/offcanvas-recent.png" alt="Recently closed tabs and saved workspaces" width="32%">
  <img src="artifacts/productivity-focus.png" alt="Focus timer session" width="32%">
  <img src="artifacts/offcanvas-mobile.png" alt="Responsive layout on a narrow viewport" width="32%">
</p>

## 📥 Installation

Daily Workspace isn't published to any add-on store — it's built and loaded as an unpacked/temporary extension.

1. **Clone the repository**:

   ```bash
   git clone https://github.com/adhikari-dikshant/tab-extension.git
   cd tab-extension
   npm install
   ```

### Chromium-based browsers (Chrome, Edge, Brave, Opera)

1. **Build**:

   ```bash
   npm run build
   ```

2. **Load it**:

   - Open `chrome://extensions` (or the equivalent `edge://extensions`, `brave://extensions`).
   - Turn on **Developer mode**.
   - Click **Load unpacked** and select the generated `dist` folder.
   - Open a new tab to see it in action.

### Firefox

Firefox doesn't support Manifest V3 service workers, so it needs a small manifest patch on top of the same build — `npm run build:firefox` handles that for you:

1. **Build**:

   ```bash
   npm run build:firefox
   ```

   This runs the normal build, then clones it into `dist-firefox/` with a Firefox-compatible `background` key and `browser_specific_settings`.

2. **Load it**:

   - Open `about:debugging#/runtime/this-firefox`.
   - Click **Load Temporary Add-on…** and select `dist-firefox/manifest.json`.
   - Open a new tab to see it in action.

   > [!NOTE]
   > Temporary add-ons are removed when Firefox restarts, so you'll need to reload it each session during development. The bundled `browser_specific_settings.gecko.id` is a placeholder — replace it with your own before submitting anywhere permanent, such as addons.mozilla.org.

## 🛠 Development

Built with React 19, TypeScript, Vite, Tailwind CSS v4, [CRXJS](https://crxjs.dev/vite-plugin), Radix UI primitives, and Phosphor icons.

```bash
npm install         # install dependencies
npm run dev         # start Vite in watch mode — load the dist folder as an unpacked extension once, then it hot-reloads
npm run build       # type-check and produce a Chromium production build in dist/
npm run build:firefox  # build, then clone it into dist-firefox/ with a Firefox-compatible manifest
npm run lint        # run ESLint
npm test            # run the productivity/background unit tests
```

## 🔐 Permissions

| Permission | Type | Why it's needed |
| --- | --- | --- |
| `storage`, `unlimitedStorage` | Required | Save your settings, shortcuts, tasks, and notes locally. |
| `alarms` | Required | Wake the background service worker for scheduled reminders and screen-time tracking. |
| `favicon` | Required (Chromium only) | Show cached site icons next to shortcuts and most-visited sites. Firefox has no equivalent API and ignores this permission — icons fall back to a public favicon service there instead. |
| `notifications` | Optional | Desktop reminders for due tasks and finished focus sessions. |
| `bookmarks` | Optional | Power the Bookmarks panel. |
| `tabs` | Optional | Screen time tracking and saving/restoring workspaces. |
| `idle` | Optional | Pause screen-time tracking while the browser is idle. |
| `sessions` | Optional | Reopen recently closed tabs. |
| `topSites` | Optional | Populate the Most Visited card. |

Optional permissions are requested only when you turn on the matching feature, and each can be revoked at any time from your browser's extension settings.

## 🛡 Privacy

Daily Workspace runs entirely on your device:

- **No accounts, no servers of ours** — settings, tasks, notes, and screen-time data are stored in `chrome.storage.local` only.
- **No analytics or trackers** — nothing about your usage is collected or transmitted.
- Weather and search-suggestion features call the relevant third-party service directly from your browser only when those features are enabled.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request, then:

1. Fork the repository.
2. Create a branch: `git checkout -b feature/your-feature`.
3. Commit your changes: `git commit -m 'Add your feature'`.
4. Push the branch: `git push origin feature/your-feature`.
5. Open a pull request.

Please also review our [Code of Conduct](./CODE_OF_CONDUCT.md).

## 🙏 Acknowledgements

The dashboard concept was inspired by the open-source [Material You New Tab](https://github.com/prem-k-r/MaterialYouNewTab) project. Daily Workspace is an independent, from-scratch implementation — it shares no code with that project.

## 📜 License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0). See the [LICENSE](./LICENSE) file for details.
