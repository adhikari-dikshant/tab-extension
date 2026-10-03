import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Separate build for the page-overlay content script.
 *
 * It cannot ride along in the main build for two reasons. A script injected by
 * `chrome.scripting.registerContentScripts` is loaded as a classic script, so it must be one
 * self-contained IIFE — the main build emits ES modules with shared chunks, which would fail to
 * load. And the registration needs a stable path, while the main build hashes filenames.
 *
 * Runs after the main build (see the `build` script) with `emptyOutDir: false` so it adds to dist/
 * rather than wiping it.
 */
export default defineConfig({
    plugins: [react()],
    // public/ is already copied by the main build, and copying it again would replace the
    // CRXJS-processed dist/manifest.json with the raw source one, whose background path points at
    // a .ts file — Chrome then refuses to load the whole extension.
    publicDir: false,
    build: {
        emptyOutDir: false,
        // Inlined into the IIFE as a string via `?inline`, since a content script has no document
        // head of its own to link a stylesheet from — it goes into the shadow root instead.
        cssCodeSplit: false,
        rollupOptions: {
            input: 'src/content/index.tsx',
            output: {
                format: 'iife',
                entryFileNames: 'content/overlay.js',
                // Belt and braces: an IIFE cannot import, so nothing may be split out.
                inlineDynamicImports: true,
            },
        },
    },
    define: { 'process.env.NODE_ENV': '"production"' },
    // Must match the production React selected above. Vite otherwise derives this from NODE_ENV,
    // which the dev server has already set to development when it runs this build in watch mode,
    // and dev JSX calls jsxDEV — undefined in production React, so the overlay crashes on mount.
    oxc: { jsx: { development: false } },
})
