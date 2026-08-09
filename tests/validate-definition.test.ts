import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { validateDefinition } from '../src/validate-definition.ts';
import { __resetRegistry, markRegistered } from '../src/registry.ts';
import { CODES } from '../src/errors.ts';
import type { ProviderDef } from '../src/types.ts';

beforeEach(() => __resetRegistry());

const okTool = (name: string, effect: 'read' | 'state-changing' = 'read') => ({
  name,
  description: 'A perfectly reasonable, specific description.',
  effect,
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler: async () => (effect === 'read' ? { ok: true } : { executed: true, confirmationId: 'X-1' }),
});

const codes = (def: ProviderDef) => validateDefinition(def).map((f) => f.code);
const hasError = (def: ProviderDef, code: string) =>
  validateDefinition(def).some((f) => f.code === code && f.severity === 'error');

test('a clean provider produces no errors', () => {
  const findings = validateDefinition({ name: 'cafe', tools: [okTool('get_menu'), okTool('place_order', 'state-changing')] });
  assert.equal(findings.filter((f) => f.severity === 'error').length, 0);
});

test('duplicate names within a provider is an error', () => {
  assert.ok(hasError({ name: 'x', tools: [okTool('dup'), okTool('dup')] }, CODES.DUPLICATE_NAME));
});

test('duplicate against the document registry is an error', () => {
  markRegistered('already');
  assert.ok(hasError({ name: 'x', tools: [okTool('already')] }, CODES.DUPLICATE_NAME));
});

test('missing inputSchema is an error', () => {
  const t = { ...okTool('t') } as Record<string, unknown>;
  delete t['inputSchema'];
  assert.ok(hasError({ name: 'x', tools: [t as never] }, CODES.MISSING_SCHEMA));
});

test('unsupported schema constructs are rejected at registration', () => {
  const withRef = {
    ...okTool('t'),
    inputSchema: { type: 'object', properties: { a: { $ref: '#/x' } }, additionalProperties: false },
  };
  assert.ok(hasError({ name: 'x', tools: [withRef] }, CODES.UNSUPPORTED_SCHEMA));

  const withUnion = { ...okTool('t2'), inputSchema: { type: ['string', 'null'], additionalProperties: false } as never };
  assert.ok(hasError({ name: 'x', tools: [withUnion] }, CODES.UNSUPPORTED_SCHEMA));

  const withOneOf = { ...okTool('t3'), inputSchema: { type: 'object', oneOf: [], additionalProperties: false } };
  assert.ok(hasError({ name: 'x', tools: [withOneOf] }, CODES.UNSUPPORTED_SCHEMA));
});

test('required naming an undeclared property is an error', () => {
  const t = {
    ...okTool('t'),
    inputSchema: { type: 'object', properties: { a: { type: 'string' } }, required: ['b'], additionalProperties: false },
  };
  assert.ok(hasError({ name: 'x', tools: [t] }, CODES.REQUIRED_UNKNOWN_PROPERTY));
});

test('missing effect and invalid effect are errors', () => {
  const noEffect = { ...okTool('t') } as Record<string, unknown>;
  delete noEffect['effect'];
  assert.ok(hasError({ name: 'x', tools: [noEffect as never] }, CODES.MISSING_EFFECT));

  const badEffect = { ...okTool('t2'), effect: 'mutates' as never };
  assert.ok(hasError({ name: 'x', tools: [badEffect] }, CODES.INVALID_EFFECT));
});

test('missing/empty description and non-function handler are errors', () => {
  const noDesc = { ...okTool('t'), description: '' };
  assert.ok(hasError({ name: 'x', tools: [noDesc] }, CODES.MISSING_DESCRIPTION));

  const badHandler = { ...okTool('t2'), handler: 42 as never };
  assert.ok(hasError({ name: 'x', tools: [badHandler] }, CODES.INVALID_HANDLER));
});

test('object schema without additionalProperties:false warns (not error)', () => {
  const t = { ...okTool('t'), inputSchema: { type: 'object', properties: {} } };
  const found = validateDefinition({ name: 'x', tools: [t] });
  assert.ok(found.some((f) => f.code === CODES.MISSING_ADDITIONAL_PROPERTIES_FALSE && f.severity === 'warning'));
  assert.equal(found.filter((f) => f.severity === 'error').length, 0);
});

test('state-changing tool emits an informational evidence notice', () => {
  assert.ok(codes({ name: 'x', tools: [okTool('c', 'state-changing')] }).includes(CODES.STATE_CHANGING_EVIDENCE_NOTICE));
});
