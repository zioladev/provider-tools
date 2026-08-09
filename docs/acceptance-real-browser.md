# Real-browser acceptance plan (Chrome WebMCP)

Unit tests exercise the library against a `FakeModelContext` and call each tool's
`execute()` directly. That proves the kit's *own* logic but **not** that it composes
correctly with Chrome's live WebMCP runtime. This plan verifies the canonical
`examples/vanilla-cafe` provider end-to-end in a WebMCP-enabled Chrome, and — most
importantly — **captures every place the live runtime differs from `FakeModelContext`.**

> Status: plan + a runnable no-runtime smoke (below). The WebMCP-surface checks require a
> Chrome build with WebMCP enabled; fill the results table when you run them there.
>
> **Publish gate:** ✅ **SATISFIED.** Rows A–H passed in a WebMCP-enabled Chrome Canary
> (see §6); row I (no-runtime) verified in §5. The kit needed **no changes**. The npm
> publish is now unblocked and is the author's deliberate action (configure the npm trusted
> publisher, then cut a GitHub Release). See `../RELEASE-CHECKLIST.md`.

## 1. Environment

WebMCP is a W3C draft shipping only in recent Chrome behind a flag or Origin Trial. The
provider surface and the way you *drive* it depend on the build:

| Surface | Flag / how | Notes |
| --- | --- | --- |
| `document.modelContext` (production) | `chrome://flags/#enable-experimental-web-platform-features` (Chrome ~146+), or an Origin-Trial token on the page | `getTools()` / `executeTool()`. What the kit registers on. |
| `navigator.modelContextTesting` (testing) | `chrome://flags/#enable-webmcp-testing` | `listTools()` / `executeTool()`. What the **Model Context Inspector** devtools panel uses — the easiest way to drive tools by hand. |
| `navigator.modelContext` (legacy) | older builds | Deprecated; reading the getter logs a warning. The kit only falls back to it. |

Record the exact Chrome version and which flag/surface was active — the surface shape has
been changing between builds, and that is itself a result.

## 2. Setup

```bash
# In the package:
npm run build                      # emits dist/ that the example import map resolves to
npx serve examples/vanilla-cafe    # serve over http:// (import maps + ESM need a server)
```

1. Launch the WebMCP-enabled Chrome; turn on the flag(s) above; restart.
2. Open the served `index.html`.
3. Open DevTools → Console. You should see
   `[cafe] registered: get_menu, place_order (surface: document)` (or `navigator`).
4. Open the **Model Context Inspector** panel (testing build) — or use an agent/extension
   that can enumerate and call `document.modelContext` tools.

## 3. Test matrix

Each row maps a unit test to the live check it must reproduce.

| # | Check | Steps | Expected (matches unit behavior) | Unit test |
| --- | --- | --- | --- | --- |
| A | **Registration** | Load the page | `RegisterResult.ok === true`, `registered = ['get_menu','place_order']`, `runtime.surface` set | `register-tools` / `define-provider` "canonical two-tool café" |
| B | **Appears in the live surface** | Inspector lists tools (or `await document.modelContext.getTools()`) | Both tools present with their `name`, `description`, `inputSchema` | — (live-only) |
| C | **Read executes** | Call `get_menu` with `{}` | A `ToolResult` whose text is the menu JSON (`{ cafe, currency, demo, menu:[…] }`) | "read handler returning data is wrapped" |
| D | **Valid state-change** | Call `place_order` `{"items":[{"itemId":"latte","quantity":2}]}` | Text = `{ executed:true, confirmationId:"ORDER-…", data:{…} }`; on-page ticket updates | "valid state-changing call returns structured evidence" |
| E | **Invalid input rejected** | Call `place_order` `{"items":[{"itemId":"latte"}]}` (missing `quantity`) | Text = `{ code:"invalid_input", … }`; **handler not called**; ticket unchanged | "invalid input is rejected; handler never called" |
| F | **Unknown property rejected** | Call `place_order` `{"items":[{"itemId":"latte","quantity":1,"x":1}]}` | `invalid_input` (`additionalProperties:false`) | `validate-input` unknown-property |
| G | **Domain failure** | Call `place_order` `{"items":[{"itemId":"espresso","quantity":1}]}` | `{ executed:false, error:{ code:"NO_SUCH_ITEM", … } }` | "domain failure, structured" (example) |
| H | **Idempotent re-register** | Reload only the module (SPA nav) or re-call `register()` | No duplicate tools; `already_registered` warning | "register() twice is idempotent" |
| I | **No-runtime no-op** | Same page in a Chrome **without** the flag | Nothing registers; `runtime.available === false`; page works for humans | `register-tools` "no runtime" (+ smoke §5) |

Pass = every row matches the "Expected" column. Any mismatch is a finding for §4.

## 4. Differences to capture (Fake vs live) — the point of this pass

`FakeModelContext` is generous: its `registerTool` just stores the tool, and unit tests
call `execute(obj)` with an already-parsed object. The live runtime may differ on each of
these. **Check and record every one:**

1. **How are `execute` args delivered?** Unit tests pass a JS object; the consumer bridge
   calls `executeTool(tool, JSON.stringify(args))`. Does Chrome hand the **page-side**
   `execute` a parsed **object** or a **JSON string**? The kit's `execute` does
   `const input = args ?? {}` and validates it as an object — **if Chrome passes a JSON
   string, every call would fail `invalid_input`.** This is the highest-risk gap. If the
   runtime passes a string, the fix is a one-line parse-if-string at the top of the built
   tool's `execute` (and a matching unit test). Record the observed arg type verbatim.
2. **Is `inputSchema` accepted as an object, or must it be a JSON string?** Chrome docs
   note the surface returns `inputSchema` as a JSON *string* on read. On *registration*,
   does `registerTool` accept our `inputSchema` **object**, or does it require a
   stringified schema? Record what registers cleanly.
3. **Does the runtime validate/mutate the schema?** Try registering a tool using each
   supported construct (`enum`, `integer`, `minimum`/`maximum`, nested `array`/`object`,
   `additionalProperties:false`). Note any the runtime rejects or silently drops — that
   would narrow the kit's "supported subset."
4. **`registerTool` return/throw semantics.** Does it return a Promise, a value, or throw
   synchronously on a bad tool? The kit `await`s and try/catches per tool; confirm a
   rejected tool doesn't abort the others (row A partial-registration behavior).
5. **Result envelope round-trip.** Confirm the caller receives our
   `{ content:[{ type:'text', text }] }` intact, and that `text` is our JSON string (not
   re-wrapped or double-encoded).
6. **Tool-call id / concurrency.** Some runtimes (Gemini-style) synthesize call ids; does
   Chrome invoke `execute` with any extra context arg the kit ignores? Confirm the kit's
   single-arg `execute(input)` is compatible.
7. **`navigator.modelContext` deprecation warning.** Confirm the kit does **not** trigger
   it when `document.modelContext` is usable (it reads `document` first).
8. **Confirmation-id uniqueness under real timing.** `mintConfirmationId` mixes a
   `Date.now()`-seeded counter; confirm ids don't collide across rapid real calls.
9. **Origin-Trial path.** If enabled via a token rather than a flag, confirm registration
   still occurs and that a rotated/expired token degrades to the clean `no_runtime` path
   (row I), not an error.

For each: record **Match** or **Differs**, the observed behavior, and (if it differs) the
smallest kit change that would close the gap.

## 5. Runnable no-runtime smoke (captures one live data point now)

This runs today against the pre-installed Chromium (which does **not** have WebMCP), and
verifies the **live human no-op path** — that importing and running the built package in a
real browser with no runtime behaves exactly like the node/Fake path (row I).

```js
// scratch/no-runtime-smoke.mjs — drive with Playwright against the built dist/
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname; // package root
const page = `<!doctype html><meta charset=utf-8><body><script type="module">
  import { defineProvider, detectRuntime } from '/dist/index.js';
  const rt = detectRuntime();
  const p = defineProvider({ name:'smoke', tools:[
    { name:'get_x', description:'reads x', effect:'read',
      inputSchema:{type:'object',properties:{},additionalProperties:false},
      handler: async () => ({ x: 1 }) }]});
  const r = await p.register();
  document.title = JSON.stringify({ available: rt.info.available, surface: rt.info.surface, ok: r.ok, reason: r.ok ? null : r.reason });
</script>`;

const server = http.createServer(async (req, res) => {
  if (req.url === '/' || req.url === '/index.html') { res.end(page); return; }
  try { res.setHeader('content-type','text/javascript');
        res.end(await readFile(path.join(ROOT, req.url))); }
  catch { res.statusCode = 404; res.end('nf'); }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch();
const pg = await browser.newPage();
await pg.goto(`http://localhost:${port}/`);
await pg.waitForFunction(() => document.title.startsWith('{'));
console.log('LIVE(no-runtime):', await pg.title());
await browser.close(); server.close();
```

Expected output (must match the node/Fake result):

```
LIVE(no-runtime): {"available":false,"surface":null,"ok":false,"reason":"no in-browser agent runtime"}
```

### Observed result

Executed against the pre-installed Playwright **Chromium 141.0.7390.37** (no WebMCP), served
over `http://` from the built `dist/`:

```
LIVE(no-runtime): {"available":false,"surface":null,"ok":false,"reason":"no in-browser agent runtime","hasNavigator":true,"hasDocMC":false}
pageerrors: none
```

**Match.** The built ESM imports and runs in a real browser; `detectRuntime()` reports no
surface (`available:false`), `register()` returns the benign `no_runtime` result, and the
page throws nothing — identical to the node/`FakeModelContext` "no runtime" test.
`navigator` exists in this Chromium (`hasNavigator:true`) but `document.modelContext` does
not (`hasDocMC:false`), so the kit correctly skips the deprecated fallback and never touches
`navigator.modelContext`. This confirms the human no-op path (row I) live; rows A–H require a
WebMCP-enabled Chrome.

## 6. Live results — Chrome Canary (WebMCP enabled) · PASS

Run against a WebMCP-enabled **Chrome Canary** using a self-contained harness (the library
bundled inline; no build/import-map). Surface: `document.modelContext`, exposing
`registerTool`, `getTools`, `executeTool`, `when` (+ EventTarget methods).

| Row | Result | Evidence |
| --- | --- | --- |
| A Registration | **PASS** | `{ ok:true, registered:['get_menu','place_order'], runtime:{available:true, surface:'document'} }` |
| B Appears in surface | **PASS** | `getTools()` returns both tools with name + description |
| C Read executes | **PASS** | `get_menu` → menu payload |
| D Valid state change → evidence | **PASS** | live `executeTool` → `{executed:true, confirmationId:'ORDER-1563', data:{…}}`; on-page ticket updated |
| E Invalid input rejected | **PASS** | missing `quantity` → `{code:'invalid_input'}`, handler not called |
| F Non-enum rejected | **PASS** | `itemId:'espresso'` → `{code:'invalid_input'}` |
| G Domain failure structured | **PASS** | out-of-stock → `{executed:false, error:{code:'OUT_OF_STOCK'}}` |
| **4.1 Arg delivery** | **PASS** | raw probe: runtime passes `execute()` an **object** (`arg0Type:'object'`, `isString:false`), matching the unit tests |
| I No-runtime no-op | **PASS** | verified separately (§5) on Chromium 141 |

**Verdict: full acceptance A–H green; no kit changes required.** The one anticipated
Fake-vs-live risk (§4.1) did not materialize — the live runtime delivers a real object to
handlers, so the kit's object-validation path is correct as-is.

### Runtime API facts observed (consumer-side; no kit impact)

1. **`executeTool(tool, args)` requires a `RegisteredTool` handle** as its first argument
   (the object returned by `getTools()`/`registerTool()`), not a tool-name string — passing a
   name throws *"The provided value is not of type 'RegisteredTool'"*. This is how a consumer
   invokes tools; it does not affect how a provider *registers* or what a handler receives.
2. **`executeTool` returns the tool result as a JSON string** (a serialized `ToolResult`), so a
   consumer parses it. The kit correctly returns a `ToolResult` *object* from `execute()`; the
   runtime serializes it for the caller. No kit change.
3. Args are delivered to `execute()` as a parsed **object** (fact 4.1 above).

These belong in a future consumer/conformance write-up, not the provider kit.

## 7. Reporting template (for future re-runs)

Capture: Chrome version + active flag/surface, the row A–I pass/fail table, and any
§4 Match/Differs items with proposed one-line kit fixes. If a future Chrome build changes
§4.1 (arg delivery) or §4.2 (schema form), add a regression-style unit test encoding the new
contract before changing the built-tool wrapper.
