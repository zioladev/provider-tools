# Release checklist — @zioladev/provider-tools

A short, repeatable path from a clean tree to a published version.

> **Publish gate (v0.1): ✅ SATISFIED.** The full live WebMCP acceptance matrix **rows A–H
> passed** in a WebMCP-enabled Chrome Canary, and row I (no-runtime) is verified — with **no
> kit changes required** (the runtime delivers handler args as objects, matching the tests).
> See `docs/acceptance-real-browser.md` §6. Publishing is now unblocked and is the author's
> deliberate action (steps below).

## One-time setup

- [x] **Secure the npm scope.** The `@ziola` scope was already taken, so the account and
      scope were created under **`@zioladev`** — this is the canonical npm scope
      (`@zioladev/provider-tools`), matching the `zioladev` GitHub org.
- [ ] **Create the standalone GitHub repo** (`zioladev/provider-tools`, public) and push
      this package's contents (it is self-contained and lifts out cleanly; a
      history-preserving `git subtree split` is prepared — see below).
- [ ] **Configure npm trusted publishing (OIDC).** On the package settings, add a
      Trusted Publisher pointing at the repo + `.github/workflows/publish.yml`. No
      `NPM_TOKEN` secret is needed.
- [ ] Confirm branch protection on `main` and that CI is required.

## Per release

- [ ] `npm run typecheck` — clean.
- [ ] `npm test` — all green.
- [ ] `npm run build` — `dist/` emits ESM + `.d.ts` with no errors.
- [ ] Update `CHANGELOG.md`: move `[Unreleased]` items under the new version + date.
- [ ] Bump `version` in `package.json` (SemVer; pre-1.0 may make breaking changes in
      minor releases).
- [ ] `npm pack --dry-run` — confirm the tarball contains `dist/`, `LICENSE`, `NOTICE`,
      `README.md` and nothing extraneous (`src/`, `tests/`, `examples/` are excluded via
      the `files` allowlist).
- [ ] Commit, tag `vX.Y.Z`, push the tag.
- [ ] Create a **GitHub Release** for the tag — this triggers `publish.yml`, which
      type-checks, tests, builds, and publishes with `--provenance` via OIDC.
- [ ] Verify the published package: `npm view @zioladev/provider-tools version` and that the
      provenance attestation appears on the npm page.

## Extracting to the standalone repo (history-preserving)

The package currently lives at `provider-tools/` inside the `valentincoffee` repo while
it is drafted. To move it to its canonical home with the subdirectory's git history
intact:

```bash
# 1. From the valentincoffee working copy, split out the subdirectory's history:
git subtree split --prefix=provider-tools -b provider-tools-export

# 2. Create the empty public repo github.com/zioladev/provider-tools (no README/license
#    so the first push is clean), then push the split branch as main:
git push git@github.com:zioladev/provider-tools.git provider-tools-export:main

# 3. Clone it fresh and verify:
git clone git@github.com:zioladev/provider-tools.git && cd provider-tools
npm install && npm run typecheck && npm test && npm run build
```

`git subtree split` rewrites the history of just `provider-tools/**` onto the new branch,
so the commits that created and shaped the package are preserved (authorship, messages).
The root Astro tsconfig exclusion and the `provider-tools/` prefix do not travel — the new
repo has the package at its root.

## Notes

- **npm scope and GitHub org match.** Both are `zioladev` — npm package
  `@zioladev/provider-tools`, GitHub repo `zioladev/provider-tools`. (The `@ziola` npm scope
  was already taken, so the account was created under `@zioladev`.)
- **Zero runtime dependencies** — keep it that way; a new dependency is a release blocker
  unless explicitly agreed.
- **Provenance** is on by default (`publishConfig.provenance = true`); it requires the
  `id-token: write` permission already set in the workflow.
- The published surface is `dist/` only. Source, tests, and examples ship on GitHub, not
  in the npm tarball.
