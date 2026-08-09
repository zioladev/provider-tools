import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerTools } from '../src/register-tools.ts';
import { __resetRegistry } from '../src/registry.ts';
import { CODES } from '../src/errors.ts';
import type { WebMCPTool } from '../src/types.ts';

class FakeModelContext {
  registered: WebMCPTool[] = [];
  rejectNames = new Set<string>();
  async registerTool(tool: WebMCPTool): Promise<void> {
    if (this.rejectNames.has(tool.name)) throw new Error(`rejected ${tool.name}`);
    this.registered.push(tool);
  }
}

const host = globalThis as unknown as { document?: unknown };

function installDocument(modelContext: unknown): void {
  host.document = { modelContext };
}
function clearDocument(): void {
  delete host.document;
}

const tool = (name: string): WebMCPTool => ({
  name,
  description: 'desc',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  execute: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
});

beforeEach(() => __resetRegistry());
afterEach(() => clearDocument());

test('no runtime → ok:false NO_RUNTIME, runtime unavailable (human no-op path)', async () => {
  clearDocument();
  const r = await registerTools([tool('a')]);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.errors[0]!.code, CODES.NO_RUNTIME);
    assert.equal(r.runtime!.available, false);
    assert.equal(r.runtime!.surface, null);
  }
});

test('malformed runtime (no registerTool) → ok:false MALFORMED_RUNTIME', async () => {
  installDocument({});
  const r = await registerTools([tool('a')]);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errors[0]!.code, CODES.MALFORMED_RUNTIME);
});

test('document surface present → registers all, surface is "document"', async () => {
  const fake = new FakeModelContext();
  installDocument(fake);
  const r = await registerTools([tool('a'), tool('b')]);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.registered, ['a', 'b']);
    assert.equal(r.runtime.surface, 'document');
    assert.equal(fake.registered.length, 2);
  }
});

test('one tool rejected → others register; ok:true with a warning', async () => {
  const fake = new FakeModelContext();
  fake.rejectNames.add('b');
  installDocument(fake);
  const r = await registerTools([tool('a'), tool('b'), tool('c')]);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.registered, ['a', 'c']);
    assert.equal(r.warnings.length, 1);
    assert.equal(r.warnings[0]!.tool, 'b');
  }
});

test('all tools rejected → ok:false', async () => {
  const fake = new FakeModelContext();
  fake.rejectNames.add('a');
  installDocument(fake);
  const r = await registerTools([tool('a')]);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errors[0]!.code, CODES.REGISTER_TOOL_FAILED);
});
