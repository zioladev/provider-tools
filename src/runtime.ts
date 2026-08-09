/**
 * WebMCP runtime detection.
 *
 * The provider surface lives on `document.modelContext` (W3C draft). Some older
 * builds expose `navigator.modelContext`; merely *reading* that getter can log a
 * deprecation warning, so we prefer `document` and only fall back if `document`
 * cannot register. When no runtime is present we return `null` and the caller
 * no-ops, leaving ordinary human visitors completely unaffected.
 */

import type { ModelContextLike, RuntimeInfo } from './types.ts';

function isUsable(candidate: unknown): candidate is ModelContextLike {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof (candidate as { registerTool?: unknown }).registerTool === 'function'
  );
}

/** Result of runtime detection: the usable context (if any) plus diagnostics. */
export interface Detection {
  context: ModelContextLike | null;
  info: RuntimeInfo;
  /** True when a modelContext object exists but exposes no usable `registerTool`. */
  malformed: boolean;
}

export function detectRuntime(): Detection {
  const doc =
    typeof document !== 'undefined'
      ? (document as unknown as { modelContext?: unknown }).modelContext
      : undefined;

  if (isUsable(doc)) {
    return { context: doc, info: { available: true, surface: 'document' }, malformed: false };
  }

  const nav =
    typeof navigator !== 'undefined'
      ? (navigator as unknown as { modelContext?: unknown }).modelContext
      : undefined;

  if (isUsable(nav)) {
    return { context: nav, info: { available: true, surface: 'navigator' }, malformed: false };
  }

  // A modelContext object exists on either surface but lacks a usable
  // `registerTool` — the runtime is present but malformed for our purposes.
  const present = doc !== undefined || nav !== undefined;
  return {
    context: null,
    info: { available: present, surface: null },
    malformed: present,
  };
}
