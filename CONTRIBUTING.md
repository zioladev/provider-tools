# Contributing

Thanks for your interest in `@zioladev/provider-tools`. This is a small, focused,
zero-dependency library; contributions that keep it that way are especially
welcome.

Canonical repository: <https://github.com/zioladev/provider-tools>

```bash
git clone https://github.com/zioladev/provider-tools.git
cd provider-tools
```

## Ground rules

- **Zero runtime dependencies.** The library must remain dependency-free. Dev
  dependencies are limited to `typescript`.
- **Scope discipline.** This package is the *provider creation* layer only —
  define, validate, register, and return structured results. Authorization,
  approval/binding, receipts, cross-model conformance, and orchestration are
  explicitly out of scope (see `docs/state-changing-tools.md`).
- **No coercion.** Invalid tool input is rejected with a structured error, never
  silently coerced.

## Development

```bash
npm install          # installs typescript (dev only)
npm run typecheck    # tsc --noEmit
npm test             # node --experimental-strip-types --test
npm run build        # emit dist/ (ESM + .d.ts)
```

Requires Node.js >= 20 (the test runner uses `--experimental-strip-types`, so no
build step is needed to run the tests against source).

## Pull requests

- Add or update tests for any behavior change; `npm test` must pass.
- Keep the supported JSON-Schema subset and error-code catalog in sync with
  `docs/validation.md` when you touch validation.
- Update `CHANGELOG.md` under `[Unreleased]`.

## Code of conduct

Be respectful and constructive. Assume good faith.
