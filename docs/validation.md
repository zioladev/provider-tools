# Validation & error codes

The kit validates in two places and never contacts a model or a network:

- **Static** (`validate()` / at the start of `register()`) — the tool definitions.
- **Invocation** (per call, inside the tool) — the incoming input, and a
  `state-changing` tool's returned evidence.

`validate()` returns a `ValidationReport`:

```ts
interface ValidationReport { ok: boolean; findings: Finding[]; }
interface Finding { code: string; severity: 'error' | 'warning' | 'informational'; message: string; tool?: string; }
```

`ok` is `true` when there are no `error`-severity findings. `register()` proceeds only
when `ok` is true; a single error blocks the **whole** provider.

## Static findings

| code | severity | meaning |
| --- | --- | --- |
| `missing_name` | error | a tool has no name |
| `duplicate_name` | error | name repeats in the provider, or is already in the document registry |
| `missing_description` | error | empty/absent description |
| `weak_description` | warning | description is very short |
| `missing_effect` | error | `effect` is absent |
| `invalid_effect` | error | `effect` is not `read` or `state-changing` |
| `missing_handler` | error | `handler` is absent (or the provider has no tools) |
| `invalid_handler` | error | `handler` is not a function |
| `missing_schema` | error | `inputSchema` is absent |
| `invalid_schema` | error | `inputSchema` is malformed (not an object, bad `properties`/`required`) |
| `unsupported_schema` | error | schema uses a construct outside the supported subset |
| `required_unknown_property` | error | `required` names a property not in `properties` |
| `missing_additional_properties_false` | warning | an object node omits `additionalProperties: false` |
| `state_changing_evidence_notice` | informational | reminder that the handler must return an `ExecutionResult` |

## Invocation findings

| code | meaning |
| --- | --- |
| `invalid_input` | call arguments do not satisfy `inputSchema`; the handler is **not** called |
| `invalid_execution_result` | a `state-changing` handler returned a non-conforming result |
| `handler_threw` | the handler threw; contained as a structured error |

## Registration / runtime

| code | meaning |
| --- | --- |
| `validation_failed` | (reason) static validation had errors; nothing registered |
| `no_runtime` | no WebMCP runtime present — the benign human no-op path |
| `malformed_runtime` | a `modelContext` exists but exposes no usable `registerTool` |
| `register_tool_failed` | the runtime rejected a specific tool (others still register) |
| `already_registered` | `register()` called again on an already-registered provider (no-op) |

All codes are exported as `CODES` for programmatic checks:

```ts
import { CODES } from '@zioladev/provider-tools';
if (result.ok === false) console.log(result.errors.map((e) => e.code));
```

## Severity philosophy

- **error** — broken, ambiguous, or unsafe; block it. At invocation, an error fails that
  single call with a structured error rather than letting bad input or unverifiable
  evidence through.
- **warning** — registers and works but violates a safe default.
- **informational** — context worth knowing (runtime absent, evidence contract in force).

The guiding rule is "better no value than a wrong one": invalid input is rejected, and
unverifiable execution evidence is an error — not a silently-accepted result.
