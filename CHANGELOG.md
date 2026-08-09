# Changelog

All notable changes to `@zioladev/provider-tools` are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial v0.1 surface: `defineProvider()`, `mintConfirmationId()`, and the full
  type contract (`ProviderDef`, `ProviderToolDef`, `Effect`, `ExecutionResult`,
  `RegisterResult`, `RuntimeInfo`, `ValidationReport`).
- Static definition validation (required `inputSchema`, supported JSON-Schema
  subset, explicit `effect`, unique names incl. a document-level registry).
- Invocation-time input validation that **rejects** invalid input (no coercion).
- Enforced structured execution evidence for `state-changing` tools.
- WebMCP runtime detection (`document.modelContext` → `navigator.modelContext`),
  no-op when absent.
- Canonical `vanilla-cafe` example and documentation set.

## [0.1.0] - unreleased
- First tagged release (pending).
