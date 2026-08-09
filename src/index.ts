/**
 * @zioladev/provider-tools
 *
 * Define, validate, and register structured browser tools for the experimental
 * WebMCP API (`document.modelContext`).
 *
 * Define your schema. Declare whether the tool reads or changes state. Provide
 * the handler. The kit handles validation, registration, structured results, and
 * runtime diagnostics.
 */

export { defineProvider } from './define-provider.ts';
export { mintConfirmationId, wrap, CODES } from './errors.ts';
export { detectRuntime } from './runtime.ts';
export { validateInput } from './validate-input.ts';
export { validateDefinition, SUPPORTED_TYPES } from './validate-definition.ts';
export { validateExecutionResult, isExecutionResult } from './execution-result.ts';

export type {
  Effect,
  JSONSchema,
  ToolInput,
  ExecutionResult,
  ProviderToolDef,
  ProviderDef,
  Provider,
  WebMCPTool,
  ToolResult,
  Severity,
  Finding,
  ValidationReport,
  RuntimeInfo,
  ProviderWarning,
  ProviderError,
  RegisterResult,
  ModelContextLike,
} from './types.ts';
