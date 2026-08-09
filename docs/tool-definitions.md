# Tool definitions

A tool is `{ name, description, effect, inputSchema, handler }`.

| field | type | notes |
| --- | --- | --- |
| `name` | `string` | Unique within the provider **and** across the document-level registry. |
| `description` | `string` | Narrow and specific — agents pick tools by description. |
| `effect` | `'read' \| 'state-changing'` | Declared explicitly. Never inferred from the name. |
| `inputSchema` | JSON-Schema object | **Required.** Supported subset only (below). |
| `handler` | `(input) => Promise<unknown> \| unknown` | Receives validated input. |

## `effect`

`effect` is the primary distinction a consumer needs. It is chosen over `kind` (too
vague) and `mutates` (too binary). A finer `quote | commit` distinction is **not** part
of v0.1 — a read tool can still return a quote, and a state-change need not be a
transaction commit — so any such semantic layer is left for later.

- `read` — the handler returns any JSON-serializable value; the kit wraps it.
- `state-changing` — the handler must return a structured `ExecutionResult`
  (see [state-changing tools](state-changing-tools.md)).

## Supported JSON-Schema subset

The kit validates that every `inputSchema` uses only these constructs, and **rejects**
anything else at registration. Staying in this subset also keeps schemas inside the
intersection that GPT, Claude, and Gemini all accept.

| Supported | Notes |
| --- | --- |
| `type` | one of `object`, `string`, `number`, `integer`, `boolean`, `array` |
| `properties` | object of sub-schemas |
| `items` | sub-schema for array elements |
| `required` | array of strings; each must exist in `properties` |
| `enum` | array of allowed values |
| `minimum` / `maximum` | numeric bounds |
| `additionalProperties` | must be `false` (or omitted) |
| `description` / `title` | free-form annotations |

**Not supported (rejected at registration):** `$ref`, `oneOf`/`anyOf`/`allOf`, `not`,
`patternProperties`, boolean-as-schema, and union types like `["string","null"]`. Use a
single concrete `type` and inline your schemas.

A **no-argument** tool still declares a schema:

```ts
inputSchema: { type: 'object', properties: {}, additionalProperties: false }
```

Every object node should set `additionalProperties: false` — the kit warns if it is
missing, because omitting it weakens input rejection.

## Input is validated and rejected, never coerced

At call time the kit validates the incoming arguments against your `inputSchema`. If they
don't conform — wrong type, missing `required`, unknown property under
`additionalProperties: false`, out-of-range number, non-`enum` value — the **handler is
not called** and the tool returns a structured `invalid_input` error. Nothing is silently
coerced, so your handler always sees input that matches its declared schema.
