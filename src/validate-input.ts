/**
 * Invocation-time input validation.
 *
 * Validates a call's arguments against the tool's declared `inputSchema` (the
 * supported JSON-Schema subset) and REJECTS anything that does not conform. No
 * coercion is ever performed — an out-of-shape value fails the call with a
 * structured error rather than being silently changed.
 */

import type { JSONSchema, ToolInput } from './types.ts';

export interface InputViolation {
  /** Dotted/bracketed path to the offending value, '' for the root. */
  path: string;
  message: string;
}

/** Validate `value` against `schema`. Returns [] when valid. */
export function validateInput(schema: JSONSchema, value: unknown): InputViolation[] {
  const out: InputViolation[] = [];
  check(schema, value, '', out);
  return out;
}

function typeName(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function isInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v);
}

function check(schema: JSONSchema, value: unknown, path: string, out: InputViolation[]): void {
  const type = schema['type'] as string | undefined;

  // enum is checked regardless of type.
  if (Array.isArray(schema['enum'])) {
    const allowed = schema['enum'] as unknown[];
    if (!allowed.some((a) => a === value)) {
      out.push({ path, message: `must be one of ${JSON.stringify(allowed)}` });
      return;
    }
  }

  switch (type) {
    case 'object':
      checkObject(schema, value, path, out);
      break;
    case 'array':
      checkArray(schema, value, path, out);
      break;
    case 'string':
      if (typeof value !== 'string') {
        out.push({ path, message: `must be a string (got ${typeName(value)})` });
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        out.push({ path, message: `must be a boolean (got ${typeName(value)})` });
      }
      break;
    case 'integer':
      if (!isInteger(value)) {
        out.push({ path, message: `must be an integer (got ${typeName(value)})` });
      } else {
        checkRange(schema, value, path, out);
      }
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        out.push({ path, message: `must be a number (got ${typeName(value)})` });
      } else {
        checkRange(schema, value, path, out);
      }
      break;
    default:
      // No/unknown type at this node: nothing to assert beyond enum (handled).
      break;
  }
}

function checkRange(schema: JSONSchema, value: number, path: string, out: InputViolation[]): void {
  const min = schema['minimum'];
  const max = schema['maximum'];
  if (typeof min === 'number' && value < min) {
    out.push({ path, message: `must be >= ${min}` });
  }
  if (typeof max === 'number' && value > max) {
    out.push({ path, message: `must be <= ${max}` });
  }
}

function checkObject(schema: JSONSchema, value: unknown, path: string, out: InputViolation[]): void {
  if (typeName(value) !== 'object') {
    out.push({ path, message: `must be an object (got ${typeName(value)})` });
    return;
  }
  const obj = value as Record<string, unknown>;
  const properties = (schema['properties'] as Record<string, JSONSchema> | undefined) ?? {};
  const required = (schema['required'] as string[] | undefined) ?? [];
  const additionalProperties = schema['additionalProperties'];

  for (const key of required) {
    if (!(key in obj)) {
      out.push({ path: join(path, key), message: 'is required' });
    }
  }

  for (const [key, child] of Object.entries(obj)) {
    const childSchema = properties[key];
    if (childSchema) {
      check(childSchema, child, join(path, key), out);
    } else if (additionalProperties === false) {
      out.push({ path: join(path, key), message: 'is not an allowed property' });
    }
    // additionalProperties !== false → extra keys are permitted and unchecked.
  }
}

function checkArray(schema: JSONSchema, value: unknown, path: string, out: InputViolation[]): void {
  if (!Array.isArray(value)) {
    out.push({ path, message: `must be an array (got ${typeName(value)})` });
    return;
  }
  const items = schema['items'] as JSONSchema | undefined;
  if (items) {
    value.forEach((el, i) => check(items, el, `${path}[${i}]`, out));
  }
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

/** Coerce the input to the handler's expected shape? No — never. Kept as a doc anchor. */
export type NoCoercion = ToolInput;
