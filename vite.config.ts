import { fileURLToPath } from 'node:url'
import { build, defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { crx, type ManifestV3Export } from '@crxjs/vite-plugin'
import manifest from './public/manifest.json' with { type: 'json' }

/**
 * The page-overlay content script is a separate IIFE build (see vite.overlay.config.ts) that the dev
 * server knows nothing about, so without this `npm run dev` leaves dist/ with no content/overlay.js
 * and the bubble can never be registered. Started once the server is listening, which is after
 * CRXJS has emptied dist/, so its output is not wiped.
 */
function overlayDevBuild(): Plugin {
    const configFile = fileURLToPath(new URL('./vite.overlay.config.ts', import.meta.url))
    return {
        name: 'overlay-dev-build',
        apply: 'serve',
        configureServer(server) {
            // The watch build reads its config once, so an edit to it only takes effect on restart.
            server.watcher.add(configFile)
            server.watcher.on('change', (file) => { if (file === configFile) void server.restart() })
            server.httpServer?.once('listening', async () => {
                const watcher = await build({
                    configFile,
                    logLevel: 'warn',
                    build: { watch: {} },
                })
                if ('close' in watcher) server.httpServer?.once('close', () => void watcher.close())
            })
        },
    }
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss(), crx({ manifest: manifest as ManifestV3Export }), overlayDevBuild()],
})
