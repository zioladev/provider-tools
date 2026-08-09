/**
 * Public type contract for @zioladev/provider-tools.
 *
 * The author declares the schema and the effect; the kit validates inputs, owns
 * the runtime envelope, isolates registration failures, and returns structured
 * provider evidence.
 */

/** Whether a tool only reads, or changes state. Declared explicitly, never inferred. */
export type Effect = 'read' | 'state-changing';

/**
 * A JSON-Schema object in the supported subset. This is intentionally a loose
 * type at the boundary (`Record<string, unknown>`); `validate-definition` checks
 * that it uses only supported constructs.
 */
export type JSONSchema = Record<string, unknown>;

/** The value a tool handler receives — the validated call input. */
export type ToolInput = Record<string, unknown>;

/**
 * Structured execution evidence a `state-changing` handler must resolve to.
 * A `read` handler returns plain data instead (wrapped by the kit).
 */
export type ExecutionResult =
  | { executed: true; confirmationId: string; data?: unknown }
  | { executed: false; error: { code: string; message: string } };

/** A single tool definition provided by the author. */
export interface ProviderToolDef {
  /** Unique within the provider (and across the document registry). */
  name: string;
  /** Narrow, specific, agent-facing description. */
  description: string;
  /** Explicit effect. Not inferred from the name. */
  effect: Effect;
  /** Required JSON-Schema object (supported subset). No-arg tools use `{ type:'object', properties:{}, additionalProperties:false }`. */
  inputSchema: JSONSchema;
  /**
   * The tool implementation. Receives validated input. A `read` handler returns
   * any JSON-serializable value; a `state-changing` handler must return an
   * `ExecutionResult`.
   */
  handler: (input: ToolInput) => Promise<unknown> | unknown;
}

/** The provider definition passed to `defineProvider`. */
export interface ProviderDef {
  /** Human-readable provider name (diagnostics only). */
  name: string;
  tools: ProviderToolDef[];
}

/** The runtime shape the WebMCP surface expects (what we register). */
export interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  execute: (args: ToolInput) => Promise<ToolResult>;
}

/** The WebMCP result envelope. */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
}

/** Severity of a validation finding. */
export type Severity = 'error' | 'warning' | 'informational';

/** A single validation finding. */
export interface Finding {
  code: string;
  severity: Severity;
  message: string;
  /** Tool name the finding applies to, when tool-scoped. */
  tool?: string;
}

/** The report returned by `validate()`. `ok` is true when there are no error-severity findings. */
export interface ValidationReport {
  ok: boolean;
  findings: Finding[];
}

/** Which WebMCP surface was detected, if any. */
export interface RuntimeInfo {
  available: boolean;
  surface: 'document' | 'navigator' | null;
}

/** A non-fatal problem encountered during registration. */
export interface ProviderWarning {
  code: string;
  message: string;
  tool?: string;
}

/** A fatal problem that blocked (all or part of) registration. */
export interface ProviderError {
  code: string;
  message: string;
  tool?: string;
}

/** The outcome of `register()`. A discriminated union on `ok`. */
export type RegisterResult =
  | {
      ok: true;
      registered: string[];
      warnings: ProviderWarning[];
      runtime: RuntimeInfo;
    }
  | {
      ok: false;
      registered: string[];
      errors: ProviderError[];
      reason: string;
      runtime?: RuntimeInfo;
    };

/** The object returned by `defineProvider`. */
export interface Provider {
  /** Run static validation without registering. */
  validate(): ValidationReport;
  /** Validate, then register with the detected WebMCP runtime. Idempotent per document context. */
  register(): Promise<RegisterResult>;
  /** The built, runtime-shaped tools (available after a successful build). */
  readonly tools: WebMCPTool[];
}

/**
 * The minimal shape we need from a WebMCP model-context object. The real surface
 * has more, but registration only requires `registerTool`.
 */
export interface ModelContextLike {
  registerTool: (tool: WebMCPTool) => unknown | Promise<unknown>;
}
