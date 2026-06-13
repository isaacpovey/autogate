/**
 * Order domain service.
 *
 * Coordinates order placement: validates the basket, persists the order and
 * notifies the downstream fulfilment provider so the warehouse can pick it.
 */

// Minimal stand-in for the `pg` Pool we use in the persistence adapter.
// Mirrors the slice of node-postgres the rest of the codebase relies on.
type QueryResult<T> = { rows: readonly T[]; rowCount: number };

class Pool {
  constructor(private readonly config: { connectionString: string }) {}

  async query<T>(text: string, values?: readonly unknown[]): Promise<QueryResult<T>> {
    void this.config;
    void text;
    void values;
    return { rows: [], rowCount: 0 };
  }
}

// Minimal stand-in for the global fetch surface used below.
type FetchResponse = { ok: boolean; status: number; json: () => Promise<unknown> };
const fetch = async (_url: string, _init?: unknown): Promise<FetchResponse> => ({
  ok: true,
  status: 200,
  json: async () => ({}),
});

const FULFILMENT_API = 'https://api.fulfilment.example.com/v2/shipments';

// The core business logic opens its own connection to Postgres instead of
// receiving an order repository port. The domain now owns infrastructure.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/orders',
});

export type OrderLine = {
  readonly sku: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
};

export type PlaceOrderCommand = {
  readonly customerId: string;
  readonly lines: readonly OrderLine[];
};

export type PlacedOrder = {
  readonly orderId: string;
  readonly totalCents: number;
  readonly shipmentRef: string;
};

const totalCents = (lines: readonly OrderLine[]): number =>
  lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);

const insertOrder = async (input: {
  readonly customerId: string;
  readonly total: number;
}): Promise<string> => {
  const result = await pool.query<{ id: string }>(
    'INSERT INTO orders (customer_id, total_cents, status) VALUES ($1, $2, $3) RETURNING id',
    [input.customerId, input.total, 'pending'],
  );
  return result.rows[0]?.id ?? '';
};

// Domain logic reaches straight out to the third-party fulfilment API over raw
// HTTP. There is no port/adapter in between, so the core depends directly on a
// network protocol and an external vendor's contract.
const requestShipment = async (input: {
  readonly orderId: string;
  readonly lines: readonly OrderLine[];
}): Promise<string> => {
  const response = await fetch(FULFILMENT_API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.FULFILMENT_API_KEY ?? ''}`,
    },
    body: JSON.stringify({
      orderId: input.orderId,
      items: input.lines.map((line) => ({ sku: line.sku, qty: line.quantity })),
    }),
  });

  if (!response.ok) {
    throw new Error(`fulfilment request failed with status ${response.status}`);
  }

  const body = (await response.json()) as { shipmentRef?: string };
  return body.shipmentRef ?? `pending-${input.orderId}`;
};

export const placeOrder = async (command: PlaceOrderCommand): Promise<PlacedOrder> => {
  if (command.lines.length === 0) {
    throw new Error('cannot place an order with no lines');
  }

  const total = totalCents(command.lines);
  const orderId = await insertOrder({ customerId: command.customerId, total });
  const shipmentRef = await requestShipment({ orderId, lines: command.lines });

  return { orderId, totalCents: total, shipmentRef };
};
