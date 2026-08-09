# State-changing tools & execution evidence

A `state-changing` tool changes something — places an order, books a slot, updates a
record. For these, the kit enforces a **structured execution-evidence contract** so a
consumer never has to guess whether the change actually happened.

## The `ExecutionResult` contract

A `state-changing` handler must resolve to one of:

```ts
// success — a state change happened
{ executed: true, confirmationId: string, data?: unknown }

// failure — a domain-level failure the handler chose to report
{ executed: false, error: { code: string, message: string } }
```

- `confirmationId` is proof a change occurred. Supply your own, or use the optional
  `mintConfirmationId(prefix)` helper (e.g. `mintConfirmationId('ORDER')` → `ORDER-4821`).
- `data` is any extra structured detail (the priced lines, the booked time, …).

If a `state-changing` handler returns something that is **not** a valid `ExecutionResult`
— no `executed` field, a missing `confirmationId`, an array, a bare string — the kit
rejects it with an `invalid_execution_result` error rather than passing an ambiguous
result to the consumer. This is a contract, not a convention: leaving execution evidence
optional is exactly what causes consumers to misclassify actions.

```ts
{
  name: 'place_order',
  description: 'Places an order and returns a confirmation.',
  effect: 'state-changing',
  inputSchema: { /* … */ },
  handler: async ({ itemId, quantity }) => {
    if (!inStock(itemId)) {
      return { executed: false, error: { code: 'OUT_OF_STOCK', message: 'Sold out.' } };
    }
    const confirmationId = mintConfirmationId('ORDER');
    record(itemId, quantity, confirmationId);
    return { executed: true, confirmationId, data: { itemId, quantity } };
  },
}
```

A handler that **throws** is contained: the kit returns
`{ executed: false, error: { code: 'handler_threw', message } }`. An exception never
escapes into the runtime.

## What the kit deliberately does NOT do

The kit is the **provider creation** layer. It does **not**:

- authorize or approve an action,
- bind or verify terms (price/quantity locking),
- produce cryptographic receipts,
- take payments,
- run cross-model conformance,
- orchestrate multi-step or multi-origin journeys.

Those are separate concerns that belong to a consumer, an assurance layer, or a future
conformance tool — not to an open provider-authoring library. Keeping this line bright is
a deliberate design decision: the kit makes it easy to *offer* a well-formed
state-changing tool with honest evidence; deciding whether a given call is *allowed* is
someone else's job.

## Read tools that return quotes

A read tool may still return a "quote" (a computed price for a configuration) — that is
just data, and it stays `effect: 'read'`. The quote→commit pairing (a read tool that
prices, a state-changing tool that commits) is a useful convention, but the kit models
only the `effect` distinction in v0.1.
