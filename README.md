# Ziola Provider Tools

**Define, validate, and register structured browser tools for the experimental
[WebMCP](https://github.com/webmachinelearning/webmcp) API.**

Repository: <https://github.com/zioladev/provider-tools> · License: Apache-2.0 · Zero
runtime dependencies.

```bash
npm install @zioladev/provider-tools
```

Define your schema. Declare whether the tool reads or changes state. Provide the
handler. The kit handles validation, registration, structured results, and runtime
diagnostics.

```ts
import { defineProvider, mintConfirmationId } from '@zioladev/provider-tools';

const provider = defineProvider({
  name: 'sample-cafe',
  tools: [
    {
      name: 'get_menu',
      description: 'Returns the current café menu and prices.',
      effect: 'read',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => ({ menu: [{ id: 'latte', price: 4.75 }] }),
    },
    {
      name: 'place_order',
      description: 'Places an order for a menu item and returns a confirmation.',
      effect: 'state-changing',
      inputSchema: {
        type: 'object',
        properties: {
          itemId: { type: 'string', enum: ['drip', 'latte'] },
          quantity: { type: 'integer', minimum: 1, maximum: 20 },
        },
        required: ['itemId', 'quantity'],
        additionalProperties: false,
      },
      handler: async ({ itemId, quantity }) => ({
        executed: true,
        confirmationId: mintConfirmationId('ORDER'),
        data: { itemId, quantity },
      }),
    },
  ],
});

await provider.register();
```

That's the entire surface.

## What the kit does for you

- **Feature-detects** the WebMCP runtime (`document.modelContext`, falling back to
  `navigator.modelContext`) and **no-ops when absent** — human visitors are unaffected.
- **Validates definitions** before registering: required `inputSchema` (supported
  subset), explicit `effect`, unique names (incl. a document-level registry).
- **Validates and rejects input** at call time against your schema — no silent coercion.
- **Owns the result envelope** — `read` handlers return plain data; the kit wraps it.
- **Enforces structured execution evidence** for `state-changing` tools
  (`{ executed, confirmationId | error }`) so consumers never misclassify an action.
- **Isolates registration failures** per tool and returns a structured `RegisterResult`.

## What it does NOT do

No authorization, approval/binding, receipts, payments, cross-model conformance, or
orchestration. This is the **provider creation** layer only. Those concerns live
elsewhere by design — see [`docs/state-changing-tools.md`](docs/state-changing-tools.md).

## Documentation

- [Getting started](docs/getting-started.md)
- [Tool definitions](docs/tool-definitions.md)
- [State-changing tools & execution evidence](docs/state-changing-tools.md)
- [Validation & error codes](docs/validation.md)
- [Browser support & runtime detection](docs/browser-support.md)
- [Real-browser acceptance plan (Chrome WebMCP)](docs/acceptance-real-browser.md)
- Canonical example: [`examples/vanilla-cafe`](examples/vanilla-cafe/)

## API reference

### `defineProvider(def: ProviderDef): Provider`

Builds a provider. `def` is `{ name: string, tools: ProviderToolDef[] }`.

`ProviderToolDef`:

| field | type | notes |
| --- | --- | --- |
| `name` | `string` | unique within the provider and the document registry |
| `description` | `string` | narrow, specific, agent-facing |
| `effect` | `'read' \| 'state-changing'` | explicit; not inferred from the name |
| `inputSchema` | JSON-Schema object | required; supported subset; `additionalProperties: false` |
| `handler` | `(input) => Promise<unknown> \| unknown` | receives validated input |

Returns a `Provider`:

- **`validate(): ValidationReport`** — static checks without registering.
- **`register(): Promise<RegisterResult>`** — validate, detect runtime, register.
  Idempotent per document context.
- **`tools: WebMCPTool[]`** — the built, runtime-shaped tools.

### `mintConfirmationId(prefix?: string): string`

Optional helper that returns a short, human-looking id like `ORDER-4821`. You may
supply your own `confirmationId` instead.

### Other exports

`wrap`, `detectRuntime`, `validateInput`, `validateDefinition`,
`validateExecutionResult`, `isExecutionResult`, `SUPPORTED_TYPES`, `CODES`, and the
full set of types (`Effect`, `ExecutionResult`, `RegisterResult`, `RuntimeInfo`,
`ValidationReport`, …).

## Requirements

- Zero runtime dependencies.
- Node.js ≥ 20 for development (tests use `--experimental-strip-types`).
- Targets Chrome builds exposing the experimental WebMCP surface (flag-gated or
  Origin-Trial-enabled). See [browser support](docs/browser-support.md).

## License

[Apache-2.0](LICENSE) © Ziola. Source at
[github.com/zioladev/provider-tools](https://github.com/zioladev/provider-tools). This is
independent open-source tooling for the experimental WebMCP API; it makes no
transaction-assurance, security, or conformance guarantees.
