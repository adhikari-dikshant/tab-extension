import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { crx, type ManifestV3Export } from '@crxjs/vite-plugin'
import manifest from './public/manifest.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss(), crx({ manifest: manifest as ManifestV3Export })],
})
