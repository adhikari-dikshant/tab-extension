// Builds the store-ready zips. Always go through this rather than zipping dist/ by hand: it
// verifies the folder first, so a dev build cannot reach a store listing.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = resolve(root, 'release')
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))

const targets = [
    { dir: 'dist', name: `daily-workspace-${version}-chrome.zip` },
    { dir: 'dist-firefox', name: `daily-workspace-${version}-firefox.zip` },
]

for (const { dir } of targets) {
    if (!existsSync(resolve(root, dir))) {
        console.error(`✖ ${dir}/ missing — run \`npm run build:firefox\` (which builds both) first.`)
        process.exit(1)
    }
    // Throws and aborts packaging if the folder is not publishable.
    execFileSync('node', [resolve(root, 'scripts/verify-build.mjs'), dir], { stdio: 'inherit', cwd: root })
}

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

for (const { dir, name } of targets) {
    // -r recurse, -q quiet, -X drop macOS extended attributes that stores reject.
    execFileSync('zip', ['-rqX', resolve(out, name), '.'], { cwd: resolve(root, dir) })
    console.log(`  → release/${name}`)
}

console.log(`\n✔ Packaged ${version}. Upload release/*.zip — do not upload dist/ directly.`)
