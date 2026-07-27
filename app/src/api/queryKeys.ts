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

  products: resource('products'),
  productHistory: (clientId: string) => ['products', 'history', clientId] as const,

  orders: resource('orders'),
  shipments: resource('shipments'),
  shipmentOrders: ['shipments', 'available-orders'] as const,
  shipmentInvoices: (shipmentId: string) => ['shipments', shipmentId, 'invoices'] as const,
  deliveries: resource('deliveries'),
  deliveryStates: ['deliveries', 'states'] as const,
  inventory: resource('inventory'),
  drivers: resource('drivers'),
  vehicles: resource('vehicles'),
  users: resource('users'),

  reminders: ['reminders'] as const,
  orderItemReminders: ['reminders', 'order-items'] as const,
} as const;
