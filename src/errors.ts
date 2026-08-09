/**
 * Error-code catalog, the result envelope, and helpers.
 *
 * Every code the kit can emit is defined here so the set is closed and
 * documentable (see docs/validation.md). Codes are stable identifiers; messages
 * are human-readable and may evolve.
 */

import type { ToolResult } from './types.ts';

/** Stable error/finding codes emitted by the kit. */
export const CODES = {
  // ── definition validation (static) ──────────────────────────────────────
  DUPLICATE_NAME: 'duplicate_name',
  MISSING_NAME: 'missing_name',
  MISSING_DESCRIPTION: 'missing_description',
  WEAK_DESCRIPTION: 'weak_description',
  MISSING_EFFECT: 'missing_effect',
  INVALID_EFFECT: 'invalid_effect',
  MISSING_HANDLER: 'missing_handler',
  INVALID_HANDLER: 'invalid_handler',
  MISSING_SCHEMA: 'missing_schema',
  INVALID_SCHEMA: 'invalid_schema',
  UNSUPPORTED_SCHEMA: 'unsupported_schema',
  REQUIRED_UNKNOWN_PROPERTY: 'required_unknown_property',
  MISSING_ADDITIONAL_PROPERTIES_FALSE: 'missing_additional_properties_false',
  STATE_CHANGING_EVIDENCE_NOTICE: 'state_changing_evidence_notice',

  // ── invocation (runtime) ────────────────────────────────────────────────
  INVALID_INPUT: 'invalid_input',
  INVALID_EXECUTION_RESULT: 'invalid_execution_result',
  HANDLER_THREW: 'handler_threw',

  // ── registration / runtime presence ─────────────────────────────────────
  VALIDATION_FAILED: 'validation_failed',
  NO_RUNTIME: 'no_runtime',
  MALFORMED_RUNTIME: 'malformed_runtime',
  REGISTER_TOOL_FAILED: 'register_tool_failed',
  ALREADY_REGISTERED: 'already_registered',
} as const;

export type Code = (typeof CODES)[keyof typeof CODES];

/** A structured, serializable error object returned inside tool results. */
export interface StructuredError {
  code: string;
  message: string;
  /** Optional machine-readable detail (e.g. the failing input path). */
  details?: unknown;
}

export function structuredError(code: string, message: string, details?: unknown): StructuredError {
  return details === undefined ? { code, message } : { code, message, details };
}

/**
 * Wrap any value into the WebMCP `ToolResult` envelope. Strings pass through as
 * text; everything else is pretty-printed JSON. Authors never build this shape
 * themselves.
 */
export function wrap(value: unknown): ToolResult {
  const text = typeof value === 'string' ? value : safeStringify(value);
  return { content: [{ type: 'text', text }] };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    // Circular or otherwise non-serializable — fall back to a stable string.
    return String(value);
  }
}

/**
 * Mint a short, human-looking confirmation id, e.g. `mintConfirmationId('ORDER')`
 * → `"ORDER-4821"`. Optional: authors may supply their own `confirmationId`.
 *
 * Not cryptographically strong and not globally unique — it is a demo/display
 * aid. Uses a module-local monotonic counter mixed with a per-call base so ids
 * are readable and non-repeating within a session without relying on `Math.random`
 * being seeded.
 */
let __seq = Math.floor(1000 + (Date.now() % 9000));
export function mintConfirmationId(prefix = 'ID'): string {
  __seq += 1;
  return `${prefix}-${__seq}`;
}
