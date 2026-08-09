import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInput } from '../src/validate-input.ts';

const orderSchema = {
  type: 'object',
  properties: {
    item: { type: 'string', enum: ['drip', 'latte'] },
    size: { type: 'string', enum: ['small', 'medium', 'large'] },
    quantity: { type: 'integer', minimum: 1, maximum: 20 },
    note: { type: 'string' },
  },
  required: ['item'],
  additionalProperties: false,
};

test('valid input yields no violations', () => {
  assert.deepEqual(validateInput(orderSchema, { item: 'latte', size: 'medium', quantity: 2 }), []);
});

test('missing required property is rejected', () => {
  const v = validateInput(orderSchema, { size: 'small' });
  assert.equal(v.length, 1);
  assert.match(v[0]!.message, /required/);
  assert.equal(v[0]!.path, 'item');
});

test('wrong type is rejected, not coerced', () => {
  const v = validateInput(orderSchema, { item: 'latte', quantity: '2' });
  assert.ok(v.some((x) => x.path === 'quantity' && /integer/.test(x.message)));
});

test('unknown property under additionalProperties:false is rejected', () => {
  const v = validateInput(orderSchema, { item: 'latte', extra: true });
  assert.ok(v.some((x) => x.path === 'extra' && /not an allowed property/.test(x.message)));
});

test('out-of-range integer is rejected', () => {
  assert.ok(validateInput(orderSchema, { item: 'latte', quantity: 0 }).some((x) => />= 1/.test(x.message)));
  assert.ok(validateInput(orderSchema, { item: 'latte', quantity: 99 }).some((x) => /<= 20/.test(x.message)));
});

test('non-enum value is rejected', () => {
  assert.ok(validateInput(orderSchema, { item: 'espresso' }).some((x) => /must be one of/.test(x.message)));
});

test('nested array items are validated', () => {
  const schema = {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: { itemId: { type: 'string' }, quantity: { type: 'integer', minimum: 1 } },
          required: ['itemId', 'quantity'],
          additionalProperties: false,
        },
      },
    },
    required: ['items'],
    additionalProperties: false,
  };
  assert.deepEqual(validateInput(schema, { items: [{ itemId: 'x', quantity: 3 }] }), []);
  const v = validateInput(schema, { items: [{ itemId: 'x' }] });
  assert.ok(v.some((x) => x.path === 'items[0].quantity' && /required/.test(x.message)));
});

test('no coercion: a valid string stays a string (validator never mutates input)', () => {
  const input = { item: 'latte', size: 'small', quantity: 1 };
  validateInput(orderSchema, input);
  assert.equal(typeof input.quantity, 'number');
  assert.equal(input.size, 'small');
});
