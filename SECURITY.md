# Security Policy

## Scope

`@zioladev/provider-tools` is a client-side library that registers tools on the
experimental WebMCP surface (`document.modelContext`). It performs **no**
authorization, approval, binding, payment, or transaction-assurance work — those
concerns live outside this package by design (see `docs/state-changing-tools.md`).
The library has **zero runtime dependencies**.

A provider author remains responsible for what their tool handlers actually do.
In particular:

- Treat all tool `input` as untrusted. The kit validates input against your
  declared `inputSchema` and rejects anything that does not conform, but your
  handler is responsible for its own domain-level authorization and side effects.
- The kit never performs a state change on your behalf; your `state-changing`
  handler does. Return honest structured evidence (`{ executed, ... }`).

## Reporting a vulnerability

Please report suspected vulnerabilities privately via GitHub Security Advisories on the
canonical repository — <https://github.com/zioladev/provider-tools/security/advisories/new>
("Report a vulnerability" on the Security tab) — rather than opening a public issue. We
aim to acknowledge reports within a few business days.

Please include: affected version, a description, and a minimal reproduction.
