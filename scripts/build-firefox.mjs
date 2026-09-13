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
// (browser_specific_settings.gecko.data_collection_permissions, itself required since Firefox
// 140). data_collection_permissions is required by AMO for all new submissions — "none" is
// accurate since this extension sends no data anywhere.
manifest.browser_specific_settings = {
    gecko: {
        id: 'daily-workspace@adhikari-dikshant.dev',
        strict_min_version: '140.0',
        data_collection_permissions: { required: ['none'] },
    },
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

console.log('Firefox build ready at dist-firefox/')
console.log('Load it via about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> select dist-firefox/manifest.json')
