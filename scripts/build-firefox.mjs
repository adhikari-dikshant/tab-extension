// Firefox doesn't support the "service_worker" background key from Manifest V3 (Chrome-only) —
// it needs the equivalent event page declared as "scripts" instead. Everything else CRXJS
// produces in dist/ (the bundled service worker file, the SPA, icons, permissions) is already
// valid WebExtension output, so this just clones dist/ and patches the one incompatible field
// rather than running a whole separate build. Run via `npm run build:firefox` (after `npm run build`).
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const distDir = resolve(root, 'dist')
const firefoxDir = resolve(root, 'dist-firefox')

if (!existsSync(distDir)) {
    console.error('dist/ not found — run `npm run build` first.')
    process.exit(1)
}

rmSync(firefoxDir, { recursive: true, force: true })
cpSync(distDir, firefoxDir, { recursive: true })

const manifestPath = resolve(firefoxDir, 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

const serviceWorker = manifest.background?.service_worker
if (!serviceWorker) {
    console.error('Expected manifest.background.service_worker in the built manifest — nothing to convert.')
    process.exit(1)
}

manifest.background = { scripts: [serviceWorker], type: manifest.background.type }

// Chrome-only permission — Firefox has no matching API and `web-ext lint` flags it as invalid.
manifest.permissions = manifest.permissions.filter((p) => p !== 'favicon')

// Placeholder add-on ID — fine for `about:debugging` temporary installs. Replace with your own
// ID (or remove gecko.id and let AMO assign one) before submitting to addons.mozilla.org.
// strict_min_version 140 covers the newest manifest key this build actually declares
// (browser_specific_settings.gecko.data_collection_permissions, itself required since Firefox 140).
//
// data_collection_permissions must describe every flow that leaves the local browser, whether or
// not we run the server receiving it. There is no first-party backend here, but three features do
// transmit to third parties, so "none" would be inaccurate:
//
//   required  websiteActivity   Shortcut and most-visited icons fall back to Google's favicon
//                               service with the site's hostname in the URL. Chrome serves these
//                               from its own cache via the `favicon` permission, which Firefox has
//                               no equivalent for (see ShortcutIcon's isFirefox branch), so on
//                               Firefox this request is unavoidable rather than opt-in.
//   optional  locationInfo      The Weather card sends coordinates to Open-Meteo and BigDataCloud,
//                               and only after the user grants geolocation.
//   optional  searchTerms       Search suggestions send the typed query to the selected engine, or
//                               to Wikipedia when that engine's host permission was declined. Off
//                               unless `searchSuggestionsEnabled` is on.
//
// The capture commands (activeTab + scripting) are deliberately absent from this list: they read a
// page's title, URL and selection into chrome.storage.local and transmit nothing, and Mozilla scopes
// these permissions to data handled outside the local browser.
//
// Keep this list, README's Privacy section, and the actual network calls in sync.
manifest.browser_specific_settings = {
    gecko: {
        id: 'daily-workspace@adhikari-dikshant.dev',
        strict_min_version: '140.0',
        data_collection_permissions: {
            required: ['websiteActivity'],
            optional: ['locationInfo', 'searchTerms'],
        },
    },
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

console.log('Firefox build ready at dist-firefox/')
console.log('Load it via about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> select dist-firefox/manifest.json')
