// Runnable, type-stripped twin of provider.ts (the annotated reference).
// index.html loads THIS file; read provider.ts to understand the types.
// The bare import is resolved by the <script type="importmap"> in index.html.
import { defineProvider, mintConfirmationId } from '@zioladev/provider-tools';

const MENU = [
  { id: 'drip', name: 'Drip Coffee', price: 3.5, inStock: true },
  { id: 'latte', name: 'Latte', price: 4.75, inStock: true },
];
const find = (id) => MENU.find((m) => m.id === id);
const money = (n) => '$' + n.toFixed(2);

function recordOrder(items, total, id) {
  document.dispatchEvent(new CustomEvent('cafe:order', { detail: { id, items, total } }));
}

export const provider = defineProvider({
  name: 'sample-cafe',
  tools: [
    {
      name: 'get_menu',
      description: 'Returns the current café menu with prices and the tool used to order each item.',
      effect: 'read',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => ({
        cafe: 'Corner Café',
        currency: 'USD',
        demo: true,
        menu: MENU.map((m) => ({ id: m.id, name: m.name, price: m.price, in_stock: m.inStock, order_tool: 'place_order' })),
      }),
    },
    {
      name: 'place_order',
      description:
        'Places a DEMO order for menu items and returns a confirmation number and total. No real order is placed and no payment is taken.',
      effect: 'state-changing',
      inputSchema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                itemId: { type: 'string', enum: ['drip', 'latte'] },
                quantity: { type: 'integer', minimum: 1, maximum: 20 },
              },
              required: ['itemId', 'quantity'],
              additionalProperties: false,
            },
          },
        },
        required: ['items'],
        additionalProperties: false,
      },
      handler: async ({ items }) => {
        const lines = [];
        for (const raw of items) {
          const m = find(raw.itemId);
          if (!m) return { executed: false, error: { code: 'NO_SUCH_ITEM', message: `no item "${raw.itemId}"` } };
          if (!m.inStock) return { executed: false, error: { code: 'OUT_OF_STOCK', message: `${m.name} is out of stock` } };
          lines.push({ itemId: raw.itemId, name: m.name, quantity: raw.quantity, line_total: +(m.price * raw.quantity).toFixed(2) });
        }
        const total = +lines.reduce((s, l) => s + l.line_total, 0).toFixed(2);
        const confirmationId = mintConfirmationId('ORDER');
        recordOrder(lines, total, confirmationId);
        return { executed: true, confirmationId, data: { items: lines, total: money(total), currency: 'USD' } };
      },
    },
  ],
});

provider.register().then((r) => {
  if (r.ok) console.info(`[cafe] registered: ${r.registered.join(', ')} (surface: ${r.runtime.surface})`);
  else console.warn(`[cafe] not registered: ${r.reason}`, 'errors' in r ? r.errors : '');
});
