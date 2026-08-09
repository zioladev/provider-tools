/**
 * Static validation of a provider definition (run before registration).
 *
 * Checks the tool definitions themselves: required fields, explicit `effect`,
 * a required `inputSchema` restricted to the supported subset, unique names
 * (within the provider and against the document registry), and safe-default
 * warnings. Pure — no I/O, no runtime.
 */

import { CODES } from './errors.ts';
import { isRegistered } from './registry.ts';
import type { Finding, JSONSchema, ProviderDef, ProviderToolDef } from './types.ts';

/** The JSON-Schema `type` values the kit supports. */
export const SUPPORTED_TYPES = ['object', 'string', 'number', 'integer', 'boolean', 'array'] as const;

/** The schema keywords the kit understands. Anything else is unsupported. */
export const SUPPORTED_KEYWORDS = new Set([
  'type',
  'properties',
  'items',
  'required',
  'enum',
  'minimum',
  'maximum',
  'additionalProperties',
  'description',
  'title',
]);

/** Keywords that are explicitly rejected with a targeted message. */
const REJECTED_KEYWORDS: Record<string, string> = {
  $ref: 'references ($ref) are not supported; inline the schema',
  oneOf: 'oneOf is not supported',
  anyOf: 'anyOf is not supported',
  allOf: 'allOf is not supported',
  not: 'not is not supported',
  patternProperties: 'patternProperties is not supported',
};

export function validateDefinition(def: ProviderDef): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  if (!Array.isArray(def.tools) || def.tools.length === 0) {
    findings.push(err(CODES.MISSING_HANDLER, 'provider has no tools'));
    return findings;
  }

  for (const tool of def.tools) {
    validateTool(tool, seen, findings);
  }
  return findings;
}

function validateTool(tool: ProviderToolDef, seen: Set<string>, findings: Finding[]): void {
  const name = typeof tool?.name === 'string' ? tool.name : undefined;

  if (!name || !name.trim()) {
    findings.push(err(CODES.MISSING_NAME, 'tool is missing a name'));
  } else {
    if (seen.has(name)) {
      findings.push(err(CODES.DUPLICATE_NAME, `duplicate tool name "${name}"`, name));
    }
    seen.add(name);
    if (isRegistered(name)) {
      findings.push(
        err(
          CODES.DUPLICATE_NAME,
          `tool name "${name}" is already registered in this document context`,
          name,
        ),
      );
    }
  }

  const scope = name ?? '(unnamed)';

  // description
  if (typeof tool?.description !== 'string' || !tool.description.trim()) {
    findings.push(err(CODES.MISSING_DESCRIPTION, 'tool is missing a description', scope));
  } else if (tool.description.trim().length < 12) {
    findings.push(
      warn(CODES.WEAK_DESCRIPTION, 'description is very short; agents select tools by description', scope),
    );
  }

  // effect
  if (tool?.effect === undefined || tool.effect === null) {
    findings.push(err(CODES.MISSING_EFFECT, 'tool is missing an explicit effect', scope));
  } else if (tool.effect !== 'read' && tool.effect !== 'state-changing') {
    findings.push(
      err(CODES.INVALID_EFFECT, `effect must be "read" or "state-changing" (got ${JSON.stringify(tool.effect)})`, scope),
    );
  } else if (tool.effect === 'state-changing') {
    findings.push(
      info(
        CODES.STATE_CHANGING_EVIDENCE_NOTICE,
        'state-changing handler must resolve to an ExecutionResult ({ executed, ... })',
        scope,
      ),
    );
  }

  // handler
  if (tool?.handler === undefined || tool.handler === null) {
    findings.push(err(CODES.MISSING_HANDLER, 'tool is missing a handler', scope));
  } else if (typeof tool.handler !== 'function') {
    findings.push(err(CODES.INVALID_HANDLER, 'handler must be a function', scope));
  }

  // inputSchema
  if (tool?.inputSchema === undefined || tool.inputSchema === null) {
    findings.push(
      err(CODES.MISSING_SCHEMA, 'inputSchema is required (a no-arg tool uses { type:"object", properties:{}, additionalProperties:false })', scope),
    );
  } else {
    validateSchema(tool.inputSchema, scope, findings, true);
  }
}

function validateSchema(
  schema: JSONSchema,
  scope: string,
  findings: Finding[],
  isRoot: boolean,
  path = '',
): void {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    findings.push(err(CODES.INVALID_SCHEMA, `schema at ${path || '(root)'} must be an object`, scope));
    return;
  }

  for (const key of Object.keys(schema)) {
    if (key in REJECTED_KEYWORDS) {
      findings.push(err(CODES.UNSUPPORTED_SCHEMA, `${REJECTED_KEYWORDS[key]} (at ${path || '(root)'})`, scope));
    } else if (!SUPPORTED_KEYWORDS.has(key)) {
      findings.push(
        err(CODES.UNSUPPORTED_SCHEMA, `unsupported schema keyword "${key}" (at ${path || '(root)'})`, scope),
      );
    }
  }

  const type = schema['type'];
  if (isRoot && type !== 'object') {
    findings.push(err(CODES.INVALID_SCHEMA, 'root inputSchema must have type "object"', scope));
  }
  if (type !== undefined) {
    if (Array.isArray(type)) {
      findings.push(
        err(CODES.UNSUPPORTED_SCHEMA, 'union types are not supported; use a single type', scope),
      );
    } else if (typeof type !== 'string' || !(SUPPORTED_TYPES as readonly string[]).includes(type)) {
      findings.push(err(CODES.UNSUPPORTED_SCHEMA, `unsupported type ${JSON.stringify(type)} (at ${path || '(root)'})`, scope));
    }
  }

  // additionalProperties must be false when present; warn if an object omits it.
  const ap = schema['additionalProperties'];
  if (ap !== undefined && ap !== false) {
    findings.push(
      err(CODES.UNSUPPORTED_SCHEMA, 'additionalProperties must be false (or omitted); true/schema forms are not supported', scope),
    );
  }
  if (type === 'object' && ap === undefined) {
    findings.push(
      warn(CODES.MISSING_ADDITIONAL_PROPERTIES_FALSE, `object schema at ${path || '(root)'} should set additionalProperties:false`, scope),
    );
  }

  // properties / required consistency
  const properties = schema['properties'];
  if (properties !== undefined) {
    if (typeof properties !== 'object' || properties === null || Array.isArray(properties)) {
      findings.push(err(CODES.INVALID_SCHEMA, `properties at ${path || '(root)'} must be an object`, scope));
    } else {
      for (const [key, child] of Object.entries(properties as Record<string, JSONSchema>)) {
        validateSchema(child, scope, findings, false, path ? `${path}.${key}` : key);
      }
    }
  }

  const required = schema['required'];
  if (required !== undefined) {
    if (!Array.isArray(required) || required.some((r) => typeof r !== 'string')) {
      findings.push(err(CODES.INVALID_SCHEMA, `required at ${path || '(root)'} must be an array of strings`, scope));
    } else {
      const propKeys = new Set(Object.keys((properties as Record<string, unknown>) ?? {}));
      for (const r of required as string[]) {
        if (!propKeys.has(r)) {
          findings.push(
            err(CODES.REQUIRED_UNKNOWN_PROPERTY, `required names "${r}" which is not in properties (at ${path || '(root)'})`, scope),
          );
        }
      }
    }
  }

  const items = schema['items'];
  if (items !== undefined) {
    validateSchema(items as JSONSchema, scope, findings, false, `${path}[]`);
  }
}

function err(code: string, message: string, tool?: string): Finding {
  return tool ? { code, severity: 'error', message, tool } : { code, severity: 'error', message };
}
function warn(code: string, message: string, tool?: string): Finding {
  return tool ? { code, severity: 'warning', message, tool } : { code, severity: 'warning', message };
}
function info(code: string, message: string, tool?: string): Finding {
  return tool ? { code, severity: 'informational', message, tool } : { code, severity: 'informational', message };
}
