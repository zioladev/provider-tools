/**
 * ExecutionResult contract enforcement.
 *
 * A `state-changing` handler must resolve to a structured ExecutionResult:
 *   { executed: true,  confirmationId: string, data?: unknown }
 *   { executed: false, error: { code: string, message: string } }
 *
 * This is a contract, not a convention: an unverifiable return (no `executed`,
 * a missing `confirmationId`, an array, etc.) is rejected so consumers never
 * have to guess whether a state change actually happened.
 */

import type { ExecutionResult } from './types.ts';

export interface ExecutionResultCheck {
  ok: boolean;
  /** Present when ok === false. */
  message?: string;
}

export function validateExecutionResult(value: unknown): ExecutionResultCheck {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, message: 'state-changing handler must return an object { executed, ... }' };
  }
  const v = value as Record<string, unknown>;
  if (typeof v['executed'] !== 'boolean') {
    return { ok: false, message: 'ExecutionResult.executed must be a boolean' };
  }
  if (v['executed'] === true) {
    if (typeof v['confirmationId'] !== 'string' || !v['confirmationId']) {
      return { ok: false, message: 'ExecutionResult.confirmationId must be a non-empty string when executed:true' };
    }
    return { ok: true };
  }
  // executed === false → require a structured error
  const error = v['error'];
  if (typeof error !== 'object' || error === null) {
    return { ok: false, message: 'ExecutionResult.error is required when executed:false' };
  }
  const e = error as Record<string, unknown>;
  if (typeof e['code'] !== 'string' || typeof e['message'] !== 'string') {
    return { ok: false, message: 'ExecutionResult.error must be { code: string, message: string }' };
  }
  return { ok: true };
}

/** Type guard mirroring the runtime check above. */
export function isExecutionResult(value: unknown): value is ExecutionResult {
  return validateExecutionResult(value).ok;
}
