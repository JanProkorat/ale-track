// Central query-key factory so invalidation stays consistent across modules.
// Pattern per resource: `.all` (root), `.list(params)`, `.detail(id)`.

type Params = Record<string, string>;

function resource(root: string) {
  return {
    all: [root] as const,
    list: (params: Params = {}) => [root, 'list', params] as const,
    detail: (id: string) => [root, 'detail', id] as const,
  };
}

export const qk = {
  // `reports` stays a flat array: useModuleCounts keys off it directly. The report
  // screens get sibling factories nested under the same root so invalidating
  // ['reports'] still clears them.
  reports: ['reports'] as const,
  reportVolume: (params: Params = {}) => ['reports', 'volume', params] as const,
  reportClients: (params: Params = {}) => ['reports', 'clients', params] as const,
  reportOperations: (params: Params = {}) => ['reports', 'operations', params] as const,
  exchangeRates: ['exchangeRates'] as const,
  countries: ['countries'] as const,

  breweries: resource('breweries'),
  breweryProducts: (breweryId: string, params: Params = {}) =>
    ['breweries', breweryId, 'products', params] as const,
  breweryReminders: (breweryId: string) => ['breweries', breweryId, 'reminders'] as const,
  breweryNotes: (breweryId: string) => ['breweries', breweryId, 'notes'] as const,

  clients: resource('clients'),
  clientNotes: (clientId: string) => ['clients', clientId, 'notes'] as const,
  clientReminders: (clientId: string) => ['clients', clientId, 'reminders'] as const,
  clientDeliveryPlaces: (clientId: string) => ['clients', clientId, 'delivery-places'] as const,
  clientProductPrices: (clientId: string) => ['clients', clientId, 'product-prices'] as const,
  // Keyed on the state too: the order editor reads only the open points while the profile reads
  // the whole history, and a shared key would make one of them show the other's list.
  clientLedger: (clientId: string, state: 'open' | 'all') =>
    ['clients', clientId, 'ledger', state] as const,
  /** Both states at once, for a write that changes the ledger whoever is reading it. */
  clientLedgers: (clientId: string) => ['clients', clientId, 'ledger'] as const,

  suppliers: resource('suppliers'),
  supplierNotes: (supplierId: string) => ['suppliers', supplierId, 'notes'] as const,

  products: resource('products'),
  productHistory: (clientId: string) => ['products', 'history', clientId] as const,

  orders: resource('orders'),
  shipments: resource('shipments'),
  shipmentOrders: ['shipments', 'available-orders'] as const,
  shipmentStartPoints: ['shipments', 'start-points'] as const,
  shipmentInvoices: (shipmentId: string) => ['shipments', shipmentId, 'invoices'] as const,
  deliveries: resource('deliveries'),
  deliveryStates: ['deliveries', 'states'] as const,
  inventory: resource('inventory'),
  sales: resource('sales'),
  // Nested under sales so completing a sale — which invalidates qk.sales.all — also refreshes
  // the counter's reports, since a completed sale is exactly what they aggregate.
  salesReportRevenue: (params: Params = {}) => ['sales', 'reports', 'revenue', params] as const,
  salesReportProducts: (params: Params = {}) => ['sales', 'reports', 'products', params] as const,
  salesReportBuyers: (params: Params = {}) => ['sales', 'reports', 'buyers', params] as const,
  // Nested under sales so invalidating qk.sales.all also refreshes a client's purchase history —
  // completing a sale changes what that client has bought before.
  saleClientHistory: (clientId: string) => ['sales', 'client-history', clientId] as const,
  drivers: resource('drivers'),
  vehicles: resource('vehicles'),
  users: resource('users'),
  roleCapabilities: resource('roleCapabilities'),

  reminders: ['reminders'] as const,
  orderItemReminders: ['reminders', 'order-items'] as const,
} as const;
