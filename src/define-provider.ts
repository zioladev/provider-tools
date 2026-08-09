/**
 * defineProvider — the public entry point.
 *
 * The author declares the schema and effect; this composes validation, the
 * runtime envelope, input rejection, and execution-evidence enforcement into a
 * `Provider` with `validate()` and `register()`.
 */

import { CODES, structuredError, wrap } from './errors.ts';
import { registerTools } from './register-tools.ts';
import { validateDefinition } from './validate-definition.ts';
import { validateInput } from './validate-input.ts';
import { validateExecutionResult } from './execution-result.ts';
import type {
  ProviderDef,
  ProviderToolDef,
  Provider,
  RegisterResult,
  ToolResult,
  ValidationReport,
  WebMCPTool,
} from './types.ts';

export function defineProvider(def: ProviderDef): Provider {
  const tools: WebMCPTool[] = (def.tools ?? []).map(buildTool);
  let registeredOnce: RegisterResult | null = null;

  function validate(): ValidationReport {
    const findings = validateDefinition(def);
    const ok = !findings.some((f) => f.severity === 'error');
    return { ok, findings };
  }

  async function register(): Promise<RegisterResult> {
    // Idempotent per document context: a second successful register() is a no-op.
    if (registeredOnce && registeredOnce.ok) {
      return {
        ok: true,
        registered: registeredOnce.registered,
        warnings: [
          { code: CODES.ALREADY_REGISTERED, message: 'provider already registered in this document context; register() is a no-op' },
        ],
        runtime: registeredOnce.runtime,
      };
    }

    const report = validate();
    if (!report.ok) {
      return {
        ok: false,
        registered: [],
        errors: report.findings
          .filter((f) => f.severity === 'error')
          .map((f) => (f.tool ? { code: f.code, message: f.message, tool: f.tool } : { code: f.code, message: f.message })),
        reason: 'validation failed',
      };
    }

    const result = await registerTools(tools);
    registeredOnce = result;
    return result;
  }

  return {
    tools,
    validate,
    register,
  };
}

/**
 * Build the runtime WebMCPTool from an author's ProviderToolDef: wrap the handler
 * so that (1) input is validated and rejected (never coerced), (2) read results
 * are enveloped, (3) state-changing results are checked against the ExecutionResult
 * contract, and (4) a thrown handler is contained as a structured error.
 */
function buildTool(def: ProviderToolDef): WebMCPTool {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
      const input = args ?? {};

      // (1) reject invalid input — no coercion
      const violations = validateInput(def.inputSchema, input);
      if (violations.length > 0) {
        const first = violations[0];
        return wrap(
          structuredError(
            CODES.INVALID_INPUT,
            first ? `${first.path ? first.path + ' ' : ''}${first.message}` : 'invalid input',
            violations,
          ),
        );
      }

      // (4) contain a thrown handler
      let raw: unknown;
      try {
        raw = await def.handler(input);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (def.effect === 'state-changing') {
          return wrap({ executed: false, error: { code: CODES.HANDLER_THREW, message } });
        }
        return wrap(structuredError(CODES.HANDLER_THREW, message));
      }

      // (3) enforce the ExecutionResult contract for state-changing tools
      if (def.effect === 'state-changing') {
        const check = validateExecutionResult(raw);
        if (!check.ok) {
          return wrap(
            structuredError(
              CODES.INVALID_EXECUTION_RESULT,
              check.message ?? 'state-changing handler returned a non-conforming result',
            ),
          );
        }
        return wrap(raw);
      }

      // (2) read: envelope plain data
      return wrap(raw);
    },
  };
}
