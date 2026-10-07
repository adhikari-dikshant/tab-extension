// Release gate: refuses to package anything that is not a clean production build.
//
// Run by `npm run package` before zipping, and safe to run by hand. It exists because a dev build
// looks like a real one from the outside — same folder, same manifest, same icons — and the only
// symptom is that every user's new tab becomes "CRXJS DEV MODE. Cannot connect to localhost:5173".
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const failures = []

function check(label, condition, detail) {
    if (!condition) failures.push(`${label}${detail ? `\n    ${detail}` : ''}`)
}

function walk(dir) {
    const out = []
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) out.push(...walk(full))
        else out.push(full)
    }
    return out
}

const target = process.argv[2] ?? 'dist'
const dir = resolve(root, target)

if (!existsSync(dir)) {
    console.error(`✖ ${target}/ does not exist — run \`npm run build\` first.`)
    process.exit(1)
}

const files = walk(dir)

// 1. Dev-server artifacts. The decisive test: no shipped file may reference the Vite dev server.
const DEV_MARKERS = [/localhost:5173/, /CRXJS DEV MODE/, /@vite\/client/, /__vite_ping/, /\/@react-refresh/]
const text = files.filter((f) => /\.(js|html|json|css|mjs)$/.test(f))
for (const file of text) {
    const body = readFileSync(file, 'utf-8')
    const hit = DEV_MARKERS.find((marker) => marker.test(body))
    check(`Dev-server artifact in ${file.slice(dir.length + 1)}`, !hit, hit && `matched ${hit}`)
}

// 2. The new tab page must be the real dashboard, not a loader stub.
const indexPath = join(dir, 'index.html')
check('index.html is missing', existsSync(indexPath))
if (existsSync(indexPath)) {
    const index = readFileSync(indexPath, 'utf-8')
    check('index.html has no <div id="root"> — this is a stub, not the dashboard', index.includes('id="root"'))
    check('index.html loads no bundled script', /<script[^>]+src="[^"]*assets\//.test(index))
}

// 3. The version in the packaged manifest must match package.json, so a release is never
//    published under the number it was last built at.
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf-8'))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
check(
    `Version mismatch: ${target}/manifest.json is ${manifest.version}, package.json is ${pkg.version}`,
    manifest.version === pkg.version,
    'Rebuild after bumping the version.',
)

// 4. Files the extension cannot run without.
for (const required of ['manifest.json', 'service-worker-loader.js', 'content/overlay.js', 'icons/icon128.png']) {
    check(`Missing ${required}`, existsSync(join(dir, required)))
}

// 5. The overlay must be the standalone IIFE bundle: registerContentScripts loads it as a classic
//    script, so a stray `import` would fail silently on every page.
const overlay = join(dir, 'content/overlay.js')
if (existsSync(overlay)) {
    const body = readFileSync(overlay, 'utf-8')
    check('content/overlay.js looks like an ES module, not a self-contained bundle', !/^\s*import[\s{*'"]/m.test(body))
    check('content/overlay.js is suspiciously small — did the build run?', body.length > 10_000)
}

if (failures.length) {
    console.error(`\n✖ ${target}/ is not publishable:\n`)
    for (const failure of failures) console.error(`  • ${failure}`)
    console.error('\nRun `npm run build` and try again. Never publish a folder a `npm run dev` has touched.\n')
    process.exit(1)
}

console.log(`✔ ${target}/ verified — production build, version ${manifest.version}, ${files.length} files.`)
