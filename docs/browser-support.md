# Browser support & runtime detection

## The surface

WebMCP exposes a page's tools to a browser-side agent through
`document.modelContext.registerTool(tool)`. This is a **W3C draft** and, at time of
writing, ships only in recent Chrome builds behind a flag or an Origin Trial. The kit
targets that surface and degrades safely everywhere else.

## Detection order

`detectRuntime()` (and therefore `register()`) looks for a usable context in this order:

1. **`document.modelContext`** — the production surface. Preferred.
2. **`navigator.modelContext`** — an older, deprecated fallback. Some builds still expose
   it; merely *reading* the getter can log a deprecation warning, so the kit only reads it
   if `document.modelContext` is not usable.

A context is "usable" only if it exposes a `registerTool` function. The detected surface
is reported back in `RegisterResult.runtime`:

```ts
interface RuntimeInfo { available: boolean; surface: 'document' | 'navigator' | null; }
```

## The three outcomes

| Situation | `register()` result |
| --- | --- |
| A usable runtime is present | `{ ok: true, registered, warnings, runtime: { available: true, surface } }` |
| No runtime at all (ordinary browser) | `{ ok: false, reason: 'no in-browser agent runtime', runtime: { available: false, surface: null } }` |
| A `modelContext` exists but has no `registerTool` | `{ ok: false, reason: 'malformed runtime', … }` |

The middle row is the important one: **when no agent runtime is present, the kit does
nothing and your page behaves exactly as it would without it.** Human visitors are never
affected. You can safely call `register()` unconditionally on every page load.

## Origin Trials (host-page responsibility)

If you enable WebMCP via an Origin Trial, the token is inlined into a `<meta>` tag at
build time and must be refreshed when it rotates — otherwise the surface silently
disappears and `register()` will report `no_runtime`. This is a property of the host
page's deployment, not of the kit. If tools stop registering after a token rotation,
rebuild and redeploy the page.

## Node / SSR

The kit is import-safe in Node and during server-side rendering: detection guards
`typeof document` / `typeof navigator`, so importing and even calling `register()` on the
server simply returns the `no_runtime` result. Registration is a browser-only effect.
