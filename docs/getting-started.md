# Getting started

`@zioladev/provider-tools` turns a website into a WebMCP provider: a set of tools an
in-browser agent can call. You write the domain logic; the kit handles validation,
registration, structured results, and runtime diagnostics.

The success test for this package is modest on purpose: **a developer unfamiliar with
its internals should be able to create a working provider in under 30 minutes.** If you
cannot, that is a bug in the kit — please open an issue.

## Install

```bash
npm install @zioladev/provider-tools
```

## The three things you provide per tool

1. **`inputSchema`** — a JSON-Schema object (required, even for no-argument tools).
2. **`effect`** — `'read'` or `'state-changing'`.
3. **`handler`** — an async function that receives validated input.

```ts
import { defineProvider } from '@zioladev/provider-tools';

const provider = defineProvider({
  name: 'my-site',
  tools: [
    {
      name: 'get_status',
      description: 'Returns the current status of the thing.',
      effect: 'read',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => ({ status: 'green' }),
    },
  ],
});

const result = await provider.register();
```

## Registering

Call `register()` once, typically at page load:

```ts
const result = await provider.register();
if (result.ok) {
  console.info(`registered ${result.registered.length} tools on ${result.runtime.surface}`);
} else {
  console.warn(`not registered: ${result.reason}`);
}
```

`register()` is a **no-op for human visitors** — if no agent runtime is present it
returns `{ ok: false, reason: 'no in-browser agent runtime', runtime: { available: false } }`
and your page is unaffected. It is **idempotent per document context**: calling it a
second time is a no-op that returns an `already_registered` warning.

## Next

- [Tool definitions](tool-definitions.md) — the full definition shape and the supported
  schema subset.
- [State-changing tools](state-changing-tools.md) — the execution-evidence contract.
- [Validation](validation.md) — what is checked and every error code.
- [Browser support](browser-support.md) — runtime detection and flags.
