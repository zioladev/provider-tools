# Vanilla Café example

The canonical reference provider: one read tool (`get_menu`) and one state-changing
tool (`place_order`), in plain browser JS. Clone the repo, open these files, and you
understand the whole package.

## Files

- **`provider.ts`** — the annotated reference source (read this to understand the types).
- **`provider.js`** — the runnable, type-stripped twin that `index.html` loads.
- **`index.html`** — a tiny page + a live order ticket, with an import map pointing the
  `@zioladev/provider-tools` bare specifier at the built package.

## Run it

```bash
# from the repo root
npm install          # dev-only: typescript
npm run build        # emits dist/ that the import map resolves to
npx serve examples/vanilla-cafe   # or any static file server
```

Then open the served page. With no in-browser agent runtime present it does nothing
visible — that's the point: human visitors are unaffected. Registration diagnostics
print to the console.

## What to try (once an agent runtime is attached)

- `get_menu {}` → the menu, wrapped as a tool result.
- `place_order {"items":[{"itemId":"latte","quantity":2}]}` → `{ executed: true,
  confirmationId: "ORDER-…", data: { … } }`, and the on-page ticket updates.
- `place_order {"items":[{"itemId":"espresso","quantity":1}]}` → a structured domain
  failure `{ executed: false, error: { code: "NO_SUCH_ITEM", … } }`.
- `place_order {"items":[{"itemId":"latte"}]}` → **rejected by the kit** with
  `{ code: "invalid_input", … }`; the handler is never called (no coercion).

## In a real site

You wouldn't ship `provider.js` — you'd install the package and import it directly:

```js
import { defineProvider } from '@zioladev/provider-tools';
```
