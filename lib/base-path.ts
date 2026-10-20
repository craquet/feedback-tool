// The deployment sub-path, baked in at build time. Empty string when the app is
// served from the domain root.
//
// Next.js automatically prefixes `next/link` hrefs, `next/navigation`
// `router.push`/`redirect`, and `next` assets with `basePath`, but it does NOT
// prefix client-side `fetch()` URLs or plain `<a href>` values. Use
// `withBasePath` for those.
//
// Must be referenced as a full static `process.env.NEXT_PUBLIC_*` expression so
// the value is inlined into the client bundle.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

export function withBasePath(path: string): string {
    return `${BASE_PATH}${path}`
}
