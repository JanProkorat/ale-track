// ---------------------------------------------------------------------------
// Replicated types & function from ShipmentLoadingTable.tsx (not exported)
// ---------------------------------------------------------------------------

interface ClientBreakdown {
  clientName: string;
  quantity: number;
}

interface AggregatedProduct {
  productId: string;
  name: string;
  kind?: any;
  packageSize?: number;
  totalQuantity: number;
  clients: ClientBreakdown[];
  isExtra?: boolean;
  displayOrder?: number;
  breweryDisplayOrder?: number;
}

interface StopFormRow {
  clientOrderId: string;
  order: number;
  selectedAddressKind: string;
}

interface StopProduct {
  id?: string;
  name?: string;
  kind?: any;
  packageSize?: number;
  quantity?: number;
}

interface Stop {
  orderId?: string;
  clientName?: string;
  products?: StopProduct[];
}

interface OrderItem {
  productId?: string;
  productName?: string;
  kind?: any;
  packageSize?: number;
  quantity?: number;
  displayOrder?: number;
  breweryDisplayOrder?: number;
}

interface Order {
  id?: string;
  clientName?: string;
  items?: OrderItem[];
}

function aggregateProducts(
  stops: Stop[],
  formStops?: StopFormRow[],
  availableOrders?: Order[],
  displayOrderMap?: Map<string, number>,
  productDisplayOrderMap?: Map<string, number>,
): AggregatedProduct[] {
  const map = new Map<string, AggregatedProduct>();
  const selectedOrderIds = formStops ? new Set(formStops.map((s) => s.clientOrderId)) : null;
  const existingOrderIds = new Set(stops.map((s) => s.orderId));

  for (const stop of stops) {
    if (selectedOrderIds && stop.orderId && !selectedOrderIds.has(stop.orderId)) continue;
    const clientName = stop.clientName ?? '—';
    for (const product of stop.products ?? []) {
      const pid = product.id ?? product.name ?? '';
      if (!pid) continue;
      let entry = map.get(pid);
      if (!entry) {
        entry = {
          productId: pid,
          name: product.name ?? '—',
          kind: product.kind,
          packageSize: product.packageSize ?? undefined,
          totalQuantity: 0,
          clients: [],
          displayOrder: productDisplayOrderMap?.get(pid),
          breweryDisplayOrder: displayOrderMap?.get(pid),
        };
        map.set(pid, entry);
      }
      const qty = product.quantity ?? 0;
      entry.totalQuantity += qty;
      entry.clients.push({ clientName, quantity: qty });
    }
  }

  if (formStops && availableOrders) {
    for (const formStop of formStops) {
      if (existingOrderIds.has(formStop.clientOrderId)) continue;
      const order = availableOrders.find((o) => o.id === formStop.clientOrderId);
      if (!order) continue;
      const clientName = order.clientName ?? '—';
      for (const item of order.items ?? []) {
        const pid = item.productId ?? item.productName ?? '';
        if (!pid) continue;
        let entry = map.get(pid);
        if (!entry) {
          entry = {
            productId: pid,
            name: item.productName ?? '—',
            kind: item.kind,
            packageSize: item.packageSize ?? undefined,
            totalQuantity: 0,
            clients: [],
            displayOrder: item.displayOrder ?? productDisplayOrderMap?.get(pid),
            breweryDisplayOrder: item.breweryDisplayOrder ?? displayOrderMap?.get(pid),
          };
          map.set(pid, entry);
        }
        const qty = item.quantity ?? 0;
        entry.totalQuantity += qty;
        entry.clients.push({ clientName, quantity: qty });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const dispA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const dispB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (dispA !== dispB) return dispA - dispB;
    const brewA = a.breweryDisplayOrder ?? Number.MAX_SAFE_INTEGER;
    const brewB = b.breweryDisplayOrder ?? Number.MAX_SAFE_INTEGER;
    if (brewA !== brewB) return brewA - brewB;
    return a.name.localeCompare(b.name);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStop(orderId: string, clientName: string, products: StopProduct[]): Stop {
  return { orderId, clientName, products };
}

function makeFormStop(clientOrderId: string, order = 0): StopFormRow {
  return { clientOrderId, order, selectedAddressKind: 'default' };
}

function makeOrder(id: string, clientName: string, items: OrderItem[]): Order {
  return { id, clientName, items };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('aggregateProducts', () => {
  // ---- Basic aggregation ----

  describe('Basic aggregation', () => {
    it('returns empty array for empty stops', () => {
      expect(aggregateProducts([])).toEqual([]);
    });

    it('aggregates products from a single stop', () => {
      const stops = [
        makeStop('o1', 'Client A', [
          { id: 'p1', name: 'Lager', quantity: 10 },
          { id: 'p2', name: 'IPA', quantity: 5 },
        ]),
      ];

      const result = aggregateProducts(stops);

      expect(result).toHaveLength(2);
      expect(result.find((r) => r.productId === 'p1')).toMatchObject({
        name: 'Lager',
        totalQuantity: 10,
        clients: [{ clientName: 'Client A', quantity: 10 }],
      });
      expect(result.find((r) => r.productId === 'p2')).toMatchObject({
        name: 'IPA',
        totalQuantity: 5,
        clients: [{ clientName: 'Client A', quantity: 5 }],
      });
    });

    it('merges same product from multiple stops (sums quantities, collects clients)', () => {
      const stops = [
        makeStop('o1', 'Client A', [{ id: 'p1', name: 'Lager', quantity: 10 }]),
        makeStop('o2', 'Client B', [{ id: 'p1', name: 'Lager', quantity: 7 }]),
      ];

      const result = aggregateProducts(stops);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        productId: 'p1',
        totalQuantity: 17,
        clients: [
          { clientName: 'Client A', quantity: 10 },
          { clientName: 'Client B', quantity: 7 },
        ],
      });
    });

    it('uses product.name as fallback ID when product.id is missing', () => {
      const stops = [
        makeStop('o1', 'Client A', [{ name: 'Mystery Beer', quantity: 3 }]),
      ];

      const result = aggregateProducts(stops);

      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('Mystery Beer');
      expect(result[0].name).toBe('Mystery Beer');
      expect(result[0].totalQuantity).toBe(3);
    });

    it('skips products with no id and no name', () => {
      const stops = [
        makeStop('o1', 'Client A', [
          { quantity: 5 },
          { id: 'p1', name: 'Lager', quantity: 10 },
        ]),
      ];

      const result = aggregateProducts(stops);

      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('p1');
    });
  });

  // ---- formStops filtering ----

  describe('formStops filtering', () => {
    const stops = [
      makeStop('o1', 'Client A', [{ id: 'p1', name: 'Lager', quantity: 10 }]),
      makeStop('o2', 'Client B', [{ id: 'p2', name: 'IPA', quantity: 5 }]),
    ];

    it('excludes DTO stops that were removed from formStops', () => {
      const formStops = [makeFormStop('o1')];

      const result = aggregateProducts(stops, formStops);

      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('p1');
    });

    it('includes DTO stops that are still in formStops', () => {
      const formStops = [makeFormStop('o1'), makeFormStop('o2')];

      const result = aggregateProducts(stops, formStops);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.productId).sort()).toEqual(['p1', 'p2']);
    });

    it('without formStops, includes all stops', () => {
      const result = aggregateProducts(stops);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.productId).sort()).toEqual(['p1', 'p2']);
    });
  });

  // ---- Newly added orders (formStops + availableOrders) ----

  describe('Newly added orders (formStops + availableOrders)', () => {
    it('adds products from new orders (in formStops but not in existing stops)', () => {
      const stops = [
        makeStop('o1', 'Client A', [{ id: 'p1', name: 'Lager', quantity: 10 }]),
      ];
      const formStops = [makeFormStop('o1'), makeFormStop('o-new')];
      const availableOrders = [
        makeOrder('o-new', 'Client C', [
          { productId: 'p3', productName: 'Stout', quantity: 8 },
        ]),
      ];

      const result = aggregateProducts(stops, formStops, availableOrders);

      expect(result).toHaveLength(2);
      expect(result.find((r) => r.productId === 'p3')).toMatchObject({
        name: 'Stout',
        totalQuantity: 8,
        clients: [{ clientName: 'Client C', quantity: 8 }],
      });
    });

    it('does NOT duplicate products from orders already in DTO stops', () => {
      const stops = [
        makeStop('o1', 'Client A', [{ id: 'p1', name: 'Lager', quantity: 10 }]),
      ];
      const formStops = [makeFormStop('o1')];
      const availableOrders = [
        makeOrder('o1', 'Client A', [
          { productId: 'p1', productName: 'Lager', quantity: 10 },
        ]),
      ];

      const result = aggregateProducts(stops, formStops, availableOrders);

      // o1 is already in stops, so availableOrders entry for o1 is skipped
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(10);
      expect(result[0].clients).toHaveLength(1);
    });

    it('merges products that appear in both DTO stops and new orders', () => {
      const stops = [
        makeStop('o1', 'Client A', [{ id: 'p1', name: 'Lager', quantity: 10 }]),
      ];
      const formStops = [makeFormStop('o1'), makeFormStop('o-new')];
      const availableOrders = [
        makeOrder('o-new', 'Client B', [
          { productId: 'p1', productName: 'Lager', quantity: 6 },
        ]),
      ];

      const result = aggregateProducts(stops, formStops, availableOrders);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        productId: 'p1',
        totalQuantity: 16,
        clients: [
          { clientName: 'Client A', quantity: 10 },
          { clientName: 'Client B', quantity: 6 },
        ],
      });
    });
  });

  // ---- Sorting ----

  describe('Sorting', () => {
    it('sorts by displayOrder first (ascending)', () => {
      const stops = [
        makeStop('o1', 'A', [{ id: 'p1', name: 'Zeta', quantity: 1 }]),
        makeStop('o2', 'B', [{ id: 'p2', name: 'Alpha', quantity: 1 }]),
      ];
      const productDisplayOrderMap = new Map([
        ['p1', 2],
        ['p2', 1],
      ]);

      const result = aggregateProducts(stops, undefined, undefined, undefined, productDisplayOrderMap);

      expect(result[0].productId).toBe('p2');
      expect(result[1].productId).toBe('p1');
    });

    it('then by breweryDisplayOrder (ascending)', () => {
      const stops = [
        makeStop('o1', 'A', [{ id: 'p1', name: 'Zeta', quantity: 1 }]),
        makeStop('o2', 'B', [{ id: 'p2', name: 'Alpha', quantity: 1 }]),
      ];
      const displayOrderMap = new Map([
        ['p1', 5],
        ['p2', 1],
      ]);
      // Same displayOrder (none provided via productDisplayOrderMap) → fall through to breweryDisplayOrder
      const result = aggregateProducts(stops, undefined, undefined, displayOrderMap, undefined);

      expect(result[0].productId).toBe('p2');
      expect(result[1].productId).toBe('p1');
    });

    it('then by name alphabetically', () => {
      const stops = [
        makeStop('o1', 'A', [{ id: 'p1', name: 'Zeta', quantity: 1 }]),
        makeStop('o2', 'B', [{ id: 'p2', name: 'Alpha', quantity: 1 }]),
      ];

      const result = aggregateProducts(stops);

      expect(result[0].name).toBe('Alpha');
      expect(result[1].name).toBe('Zeta');
    });

    it('products without displayOrder go to the end', () => {
      const stops = [
        makeStop('o1', 'A', [{ id: 'p1', name: 'NoOrder', quantity: 1 }]),
        makeStop('o2', 'B', [{ id: 'p2', name: 'HasOrder', quantity: 1 }]),
      ];
      const productDisplayOrderMap = new Map([['p2', 1]]);

      const result = aggregateProducts(stops, undefined, undefined, undefined, productDisplayOrderMap);

      expect(result[0].productId).toBe('p2');
      expect(result[1].productId).toBe('p1');
    });

    it('products without breweryDisplayOrder but with displayOrder sort correctly', () => {
      const stops = [
        makeStop('o1', 'A', [{ id: 'p1', name: 'A', quantity: 1 }]),
        makeStop('o2', 'B', [{ id: 'p2', name: 'B', quantity: 1 }]),
        makeStop('o3', 'C', [{ id: 'p3', name: 'C', quantity: 1 }]),
      ];
      const productDisplayOrderMap = new Map([
        ['p1', 1],
        ['p2', 1],
        ['p3', 2],
      ]);
      // p1 has breweryDisplayOrder, p2 does not — both have same displayOrder
      const displayOrderMap = new Map([['p1', 3]]);

      const result = aggregateProducts(stops, undefined, undefined, displayOrderMap, productDisplayOrderMap);

      // p1 and p2 share displayOrder=1; p1 has breweryDisplayOrder=3, p2 has none (MAX)
      // so p1 comes before p2; p3 has displayOrder=2 so it's last
      expect(result.map((r) => r.productId)).toEqual(['p1', 'p2', 'p3']);
    });
  });

  // ---- Display order maps ----

  describe('Display order maps', () => {
    it('uses productDisplayOrderMap for stop products', () => {
      const stops = [
        makeStop('o1', 'A', [{ id: 'p1', name: 'Lager', quantity: 1 }]),
      ];
      const productDisplayOrderMap = new Map([['p1', 42]]);

      const result = aggregateProducts(stops, undefined, undefined, undefined, productDisplayOrderMap);

      expect(result[0].displayOrder).toBe(42);
    });

    it('uses displayOrderMap for brewery display order', () => {
      const stops = [
        makeStop('o1', 'A', [{ id: 'p1', name: 'Lager', quantity: 1 }]),
      ];
      const displayOrderMap = new Map([['p1', 99]]);

      const result = aggregateProducts(stops, undefined, undefined, displayOrderMap, undefined);

      expect(result[0].breweryDisplayOrder).toBe(99);
    });

    it('falls back to maps when order items do not have their own displayOrder/breweryDisplayOrder', () => {
      const stops: Stop[] = [];
      const formStops = [makeFormStop('o-new')];
      const availableOrders = [
        makeOrder('o-new', 'Client X', [
          { productId: 'p1', productName: 'Lager', quantity: 5 },
        ]),
      ];
      const displayOrderMap = new Map([['p1', 7]]);
      const productDisplayOrderMap = new Map([['p1', 3]]);

      const result = aggregateProducts(stops, formStops, availableOrders, displayOrderMap, productDisplayOrderMap);

      expect(result[0].displayOrder).toBe(3);
      expect(result[0].breweryDisplayOrder).toBe(7);
    });
  });
});
