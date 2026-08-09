/**
 * Feature-detect the WebMCP runtime and register a set of built tools.
 *
 * Registration is per-tool isolated: one tool being rejected by a shifting draft
 * does not abort the rest. Successfully registered names are recorded in the
 * document-level registry. Returns a discriminated `RegisterResult`.
 */

import { CODES } from './errors.ts';
import { detectRuntime } from './runtime.ts';
import { markRegistered } from './registry.ts';
import type { ProviderError, ProviderWarning, RegisterResult, WebMCPTool } from './types.ts';

export async function registerTools(tools: WebMCPTool[]): Promise<RegisterResult> {
  const { context, info, malformed } = detectRuntime();

  if (!context) {
    if (malformed) {
      return {
        ok: false,
        registered: [],
        errors: [{ code: CODES.MALFORMED_RUNTIME, message: 'a modelContext is present but exposes no usable registerTool' }],
        reason: 'malformed runtime',
        runtime: info,
      };
    }
    // The normal no-op-for-humans path: no agent runtime present.
    return {
      ok: false,
      registered: [],
      errors: [{ code: CODES.NO_RUNTIME, message: 'no in-browser agent runtime detected' }],
      reason: 'no in-browser agent runtime',
      runtime: info,
    };
  }

  const registered: string[] = [];
  const failures: ProviderError[] = [];

  for (const tool of tools) {
    try {
      await context.registerTool(tool);
      markRegistered(tool.name);
      registered.push(tool.name);
    } catch (e) {
      failures.push({
        code: CODES.REGISTER_TOOL_FAILED,
        message: `registerTool failed for "${tool.name}": ${errMessage(e)}`,
        tool: tool.name,
      });
    }
  }

  if (registered.length === 0) {
    return {
      ok: false,
      registered,
      errors: failures.length
        ? failures
        : [{ code: CODES.REGISTER_TOOL_FAILED, message: 'no tools were registered' }],
      reason: 'no tools registered',
      runtime: info,
    };
  }

  // Partial registration still works; surviving failures become warnings.
  const warnings: ProviderWarning[] = failures.map((f) =>
    f.tool ? { code: f.code, message: f.message, tool: f.tool } : { code: f.code, message: f.message },
  );
  return { ok: true, registered, warnings, runtime: info };
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
