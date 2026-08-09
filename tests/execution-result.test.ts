import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateExecutionResult, isExecutionResult } from '../src/execution-result.ts';

test('a valid executed:true result passes', () => {
  assert.ok(validateExecutionResult({ executed: true, confirmationId: 'ORDER-1', data: { x: 1 } }).ok);
  assert.ok(isExecutionResult({ executed: true, confirmationId: 'ORDER-1' }));
});

test('executed:true without a confirmationId fails', () => {
  const r = validateExecutionResult({ executed: true, data: {} });
  assert.equal(r.ok, false);
  assert.match(r.message!, /confirmationId/);
});

test('a valid executed:false result with structured error passes', () => {
  assert.ok(validateExecutionResult({ executed: false, error: { code: 'OUT_OF_STOCK', message: 'no' } }).ok);
});

test('executed:false without a structured error fails', () => {
  assert.equal(validateExecutionResult({ executed: false }).ok, false);
  assert.equal(validateExecutionResult({ executed: false, error: { code: 'x' } }).ok, false);
});

test('missing executed / array / non-object are rejected', () => {
  assert.equal(validateExecutionResult({ confirmationId: 'x' }).ok, false);
  assert.equal(validateExecutionResult([1, 2, 3]).ok, false);
  assert.equal(validateExecutionResult('done').ok, false);
  assert.equal(validateExecutionResult(null).ok, false);
});
