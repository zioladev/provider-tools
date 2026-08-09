import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { defineProvider } from '../src/define-provider.ts';
import { mintConfirmationId } from '../src/errors.ts';
import { __resetRegistry } from '../src/registry.ts';
import { CODES } from '../src/errors.ts';
import type { ToolResult, WebMCPTool } from '../src/types.ts';

class FakeModelContext {
  registered: WebMCPTool[] = [];
  async registerTool(tool: WebMCPTool): Promise<void> {
    this.registered.push(tool);
  }
}
const host = globalThis as unknown as { document?: unknown };
const install = (mc: unknown) => {
  host.document = { modelContext: mc };
};
const clear = () => {
  delete host.document;
};

/** Unwrap a ToolResult's single text block back into a value. */
function unwrap(result: ToolResult): unknown {
  const text = result.content[0]!.text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const readTool = (name = 'get_menu') => ({
  name,
  description: 'Returns the current café menu and prices.',
  effect: 'read' as const,
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler: async () => ({ menu: ['drip', 'latte'] }),
});

const orderTool = (name = 'place_order') => ({
  name,
  description: 'Places a demo order and returns structured evidence.',
  effect: 'state-changing' as const,
  inputSchema: {
    type: 'object',
    properties: {
      item: { type: 'string', enum: ['drip', 'latte'] },
      quantity: { type: 'integer', minimum: 1, maximum: 20 },
    },
    required: ['item'],
    additionalProperties: false,
  },
  handler: async ({ item }: Record<string, unknown>) => ({
    executed: true,
    confirmationId: mintConfirmationId('ORDER'),
    data: { item },
  }),
});

beforeEach(() => __resetRegistry());
afterEach(() => clear());

test('validation error blocks registration; nothing is registered', async () => {
  const fake = new FakeModelContext();
  install(fake);
  const bad = { ...readTool(), effect: 'nope' as never };
  const r = await defineProvider({ name: 'x', tools: [bad] }).register();
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'validation failed');
  assert.equal(fake.registered.length, 0);
});

test('read handler returning data is wrapped as a ToolResult', async () => {
  const fake = new FakeModelContext();
  install(fake);
  const p = defineProvider({ name: 'cafe', tools: [readTool()] });
  const r = await p.register();
  assert.equal(r.ok, true);
  const out = await fake.registered[0]!.execute({});
  assert.ok(Array.isArray(out.content) && out.content[0]!.type === 'text');
  assert.deepEqual(unwrap(out), { menu: ['drip', 'latte'] });
});

test('valid state-changing call returns structured execution evidence', async () => {
  const fake = new FakeModelContext();
  install(fake);
  await defineProvider({ name: 'cafe', tools: [orderTool()] }).register();
  const out = await fake.registered[0]!.execute({ item: 'latte', quantity: 2 });
  const val = unwrap(out) as Record<string, unknown>;
  assert.equal(val['executed'], true);
  assert.match(String(val['confirmationId']), /^ORDER-/);
});

test('invalid input is rejected by the kit; handler is never called', async () => {
  const fake = new FakeModelContext();
  install(fake);
  let called = false;
  const t = {
    ...orderTool(),
    handler: async () => {
      called = true;
      return { executed: true, confirmationId: 'X' };
    },
  };
  await defineProvider({ name: 'cafe', tools: [t] }).register();
  const out = await fake.registered[0]!.execute({ quantity: 0 }); // missing item, quantity < min
  const val = unwrap(out) as Record<string, unknown>;
  assert.equal(val['code'], CODES.INVALID_INPUT);
  assert.equal(called, false);
});

test('state-changing handler returning a non-conforming result is rejected', async () => {
  const fake = new FakeModelContext();
  install(fake);
  const t = {
    ...orderTool(),
    handler: async () => ({ status: 'confirmed' }), // no `executed`
  };
  await defineProvider({ name: 'cafe', tools: [t] }).register();
  const out = await fake.registered[0]!.execute({ item: 'latte' });
  assert.equal((unwrap(out) as Record<string, unknown>)['code'], CODES.INVALID_EXECUTION_RESULT);
});

test('a state-changing handler that throws is contained as structured evidence', async () => {
  const fake = new FakeModelContext();
  install(fake);
  const t = {
    ...orderTool(),
    handler: async () => {
      throw new Error('boom');
    },
  };
  await defineProvider({ name: 'cafe', tools: [t] }).register();
  const out = await fake.registered[0]!.execute({ item: 'latte' });
  const val = unwrap(out) as Record<string, unknown>;
  assert.equal(val['executed'], false);
  assert.equal((val['error'] as Record<string, unknown>)['code'], CODES.HANDLER_THREW);
});

test('register() twice is idempotent (no-op with ALREADY_REGISTERED warning)', async () => {
  const fake = new FakeModelContext();
  install(fake);
  const p = defineProvider({ name: 'cafe', tools: [readTool()] });
  const first = await p.register();
  const second = await p.register();
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (second.ok) assert.equal(second.warnings[0]!.code, CODES.ALREADY_REGISTERED);
  assert.equal(fake.registered.length, 1); // not re-registered
});

test('mintConfirmationId formats with the given prefix and is non-repeating', () => {
  const a = mintConfirmationId('ORDER');
  const b = mintConfirmationId('ORDER');
  assert.match(a, /^ORDER-\d+$/);
  assert.notEqual(a, b);
});

test('canonical two-tool café registers both tools', async () => {
  const fake = new FakeModelContext();
  install(fake);
  const r = await defineProvider({ name: 'sample-cafe', tools: [readTool(), orderTool()] }).register();
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.registered, ['get_menu', 'place_order']);
});
