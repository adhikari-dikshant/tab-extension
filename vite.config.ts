import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { crx, type ManifestV3Export } from '@crxjs/vite-plugin'
import manifest from './public/manifest.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
    plugins: [react(), tailwindcss(), crx({ manifest: manifest as ManifestV3Export })],
    build: {
        // `vite dev` and `vite build` both write a full extension folder through CRXJS. Pointing dev
        // at its own directory keeps the two apart: a dev run writes a stub index.html that loads
        // from the Vite dev server, and if that lands in dist/ it is indistinguishable from a real
        // build until someone installs the published zip and gets "CRXJS DEV MODE" as their new tab.
        // That shipped once (0.2.0) — hence this split, plus scripts/verify-build.mjs as a backstop.
        outDir: command === 'serve' ? 'dist-dev' : 'dist',
    },
}))
