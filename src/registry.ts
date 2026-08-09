/**
 * Document-level tool-name registry.
 *
 * Two separate `defineProvider().register()` calls on one page can collide on a
 * tool name. The kit keeps a per-document set of names it has already registered
 * so it can detect (and refuse) its own duplicates. It cannot see registrations
 * made outside the kit.
 */

const GLOBAL_KEY = '__ziolaProviderToolRegistry__';

interface RegistryHost {
  [GLOBAL_KEY]?: Set<string>;
}

/**
 * Resolve the shared registry. Prefers a document-scoped store so it is naturally
 * per-page; falls back to a module-local set when no `document`/`globalThis` host
 * is available (e.g. some test environments).
 */
function store(): Set<string> {
  const host: RegistryHost =
    (typeof globalThis !== 'undefined' ? (globalThis as unknown as RegistryHost) : undefined) ??
    moduleLocal;
  let set = host[GLOBAL_KEY];
  if (!set) {
    set = new Set<string>();
    host[GLOBAL_KEY] = set;
  }
  return set;
}

const moduleLocal: RegistryHost = {};

/** Names already registered in this document context. */
export function registeredNames(): ReadonlySet<string> {
  return store();
}

/** True if `name` is already registered by the kit in this document context. */
export function isRegistered(name: string): boolean {
  return store().has(name);
}

/** Record that `name` has been registered. */
export function markRegistered(name: string): void {
  store().add(name);
}

/**
 * Test-only: clear the registry. Not part of the public API surface (not
 * re-exported from index); used by the test suite to isolate cases.
 */
export function __resetRegistry(): void {
  store().clear();
}
