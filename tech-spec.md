# New-tab dashboard — full technical spec

This doc answers three things end to end: what MYNT actually is under the hood, how our build differs and why, and the concrete steps/mechanics to get from zero to a working extension.

---

## 1. What MYNT actually is (the baseline we're improving on)

Confirmed from the repo: **no framework, no build step.** The codebase is plain JavaScript (67%), HTML (21%), CSS (12%) — a flat `index.html` + `style.css` + a `scripts/` folder of vanilla JS modules, `locales/` for 32-language i18n JSON files, `svgs/` and `fonts/` for assets, one `manifest.json` for Chromium and a second `manifest(firefox).json` swapped in manually for Firefox.

That's a legitimate architecture for what MYNT is — it means zero build tooling, instant load, and anyone can `git clone` and load it unpacked with no `npm install` at all. The trade-off: no component model, no type safety, state management is whatever DOM manipulation + `chrome.storage` calls each script file does directly, and adding a new stateful widget means wiring vanilla event listeners by hand every time.

**This matters for us because**: your ask — smoother UX, a unified command bar, modal-driven detail views, a stateful screen-time tracker — all get meaningfully harder to build cleanly without a component model and typed state. MYNT works because its feature set is mostly "render some data, listen for a click." Yours has real cross-widget state (command bar actions affecting multiple cards, screen time needing background-to-UI sync). That's the actual justification for React + TypeScript + Vite here — not "frameworks are better," but this specific feature set benefits from it.

---

## 2. Architecture comparison

| | MYNT | This project |
|---|---|---|
| Rendering | Direct DOM manipulation per script | React components, declarative state |
| State | Scattered across script files, read/write `chrome.storage` ad hoc | Centralized typed storage layer (`lib/storage.ts`), React state derived from it |
| Build | None — files served as-is | Vite + CRXJS, HMR during dev, bundled/minified for release |
| Styling | Hand-written CSS, one global `style.css` | Tailwind utility classes + CSS variables for theming |
| Types | None (plain JS) | TypeScript throughout — storage schema, message passing, component props all typed |
| i18n | JSON files per language in `locales/`, loaded and swapped manually | Same JSON-per-language pattern works fine here — no need to reinvent this part, MYNT's approach is sound |
| Firefox support | Second manifest file, manually renamed by the user pre-load | Same pattern, but generated as a build target (`vite build --mode firefox`) instead of a manual file swap |
| Background logic | None needed — MYNT has no persistent background state | Service worker required for screen-time tracking (section 5) |

Where MYNT's approach is worth keeping as-is rather than "improving": the locale-JSON i18n pattern, and the fact that it ships with zero runtime dependencies beyond the browser itself. Don't reach for an i18n library — a typed version of what MYNT already does is enough.

---

## 3. How to start — concrete steps

```bash
# 1. Scaffold with Vite's React+TS template
npm create vite@latest newtab-extension -- --template react-ts
cd newtab-extension

# 2. Add CRXJS (handles manifest + extension-specific bundling)
npm install @crxjs/vite-plugin -D

# 3. Add Tailwind
npm install tailwindcss @tailwindcss/vite

# 4. Add chrome types so TypeScript understands chrome.* APIs
npm install @types/chrome -D
```

`vite.config.ts` needs CRXJS wired in and pointed at your manifest:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import manifest from "./public/manifest.json";

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
});
```

From here: `npm run dev` launches Vite, then `chrome://extensions` → Developer Mode → Load unpacked → select the `dist` (or dev output) folder — same manual-load step MYNT's README walks through, just pointed at a build output instead of raw source.

**First milestone** (proves the whole pipeline works before building any real feature): a new tab that shows nothing but the clock, reading/writing nothing. If that renders via `chrome_url_overrides.newtab` in the manifest, CRXJS + React + Tailwind are wired correctly and everything after this is additive.

---

## 4. How the frontend will actually work

**Rendering entry point**: `index.html` → `src/pages/NewTab.tsx` → `<BentoGrid>` rendering a list of card components, each subscribing to its own slice of storage.

**State flow for a typical card** (to-do, as an example):
1. On mount, `TodoCard` reads `todos` from `chrome.storage.local` via the typed `lib/storage.ts` wrapper, sets local React state.
2. It also registers a `chrome.storage.onChanged` listener scoped to the `todos` key — so if the background worker or another tab's instance of the dashboard changes the data, this card updates without a manual refresh.
3. User actions (check a box, add via the command bar) write straight to `chrome.storage.local`; the `onChanged` listener is what reflects it back into the UI — write and read paths never talk to each other directly, storage is the single source of truth. This avoids the classic bug of local state drifting from storage.

**Command bar** is the one component with cross-cutting effects — it needs to know about to-dos, bookmarks, and shortcuts to route input correctly. Keep its parsing logic (`t:`, `b:`, bare text → search) in `lib/commandParser.ts`, decoupled from the component itself, so it's testable without rendering anything.

**Modal system**: one `<Modal>` component mounted once at the page root, controlled by a simple `activeModal: string | null` piece of state (a lightweight context, not a full state library — this app doesn't need Redux/Zustand for a state tree this small). Any card can request `openModal('screenTime')`; the modal component looks up which content to render by key.

---

## 5. How the background/service worker will actually work

This is the part with no MYNT equivalent — MYNT has no background script because it has no feature that needs to persist state while the new-tab page isn't open. Screen-time tracking does.

**The mechanics**, concretely:
1. `src/background/index.ts` is registered as the MV3 service worker in the manifest.
2. It attaches listeners for `chrome.tabs.onActivated`, `chrome.tabs.onUpdated`, `chrome.windows.onFocusChanged`, and `chrome.idle.onStateChanged` — all detailed with edge cases in the backend spec (section 3 there).
3. Because MV3 workers get killed when idle, the worker can't hold long-lived state safely in memory alone — it flushes the current interval to `chrome.storage.local` on an `alarms`-driven interval (~every 30s), so a killed worker loses at most that window, not the whole session.
4. The new-tab page never talks to the service worker directly for this data — it just reads `chrome.storage.local` and listens for changes, same pattern as every other card. The service worker's only job is to keep that storage accurate in the background.

This separation matters: it means the UI layer has one consistent way of getting data (read + subscribe to storage) regardless of whether that data came from a direct user action or a background process. No special-casing "live" widgets vs "static" ones.

---

## 6. Where MYNT's simplicity should inform scope, not just its features

Two things worth taking from MYNT's approach even though we're using a framework:
- **Keep the manifest lean at each stage**, exactly like section 8 of the project spec already lays out — MYNT ships with a fairly wide permission set because its feature set justifies it; ours should only ask for `tabs`/`idle` once the screen-time feature is actually being built, not from day one.
- **No runtime dependency bloat.** MYNT ships with zero third-party runtime code. Our React/Tailwind/CRXJS stack is a dev-time and build-time choice — the shipped bundle should still be small and dependency-light on the runtime side (avoid pulling in a large icon library or animation library wholesale if a handful of hand-picked icons/CSS transitions cover it).

---

## 7. First-week build order

A concrete sequence, not just a feature list, so the "how we will start" question has an actual answer:

1. Scaffold (section 3) → confirm clock renders via manifest override.
2. `lib/storage.ts` typed wrapper + one working read/write round trip (settings: theme toggle is a good first real feature — small surface, touches storage, touches theming).
3. `BentoGrid` layout with 2-3 placeholder cards, confirm the grid sizing behaves before any card has real content.
4. Shortcuts card (simplest real feature: CRUD on an array, no external API, no background worker).
5. To-do card + the `alarms`-driven daily reset — first place `alarms` gets used, good forcing function to get that pattern right early since focus timer and screen time both depend on it later.
6. Command bar wired to shortcuts + to-do (`t:` prefix) — proves the cross-cutting input pattern before bookmarks/search are added on top.
7. Everything else in section 6 of the project spec's roadmap follows from here.