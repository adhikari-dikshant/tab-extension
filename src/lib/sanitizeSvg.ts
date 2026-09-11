/** Strips script-capable constructs from raw SVG markup before it's stored as a data URL. */
export function sanitizeSvgMarkup(svg: string): string {
    return svg
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
}
