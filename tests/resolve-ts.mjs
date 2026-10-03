// Node's --experimental-strip-types runs TypeScript directly but does not extend module
// resolution, so an extensionless relative import ("./storage") that Vite resolves happily fails
// under `node --test`. Until now no tested module imported anything but types across files, so it
// never came up. This hook closes that gap by trying the .ts/.tsx file the bundler would pick.
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const EXTENSIONS = ['.ts', '.tsx']

export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier) && context.parentURL) {
        const base = fileURLToPath(new URL(specifier, context.parentURL))
        for (const extension of EXTENSIONS) {
            if (existsSync(base + extension)) {
                return { url: pathToFileURL(base + extension).href, shortCircuit: true, format: 'module-typescript' }
            }
        }
    }
    return nextResolve(specifier, context)
}
