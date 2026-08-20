import { type ModuleKey } from 'src/auth/permissions';

/**
 * One path per module, plus the screens that live inside a module's permission but need a route
 * of their own. `/sales-reports` deliberately sits beside `/sales` rather than under it — the
 * `/sales/:id` detail route already owns that segment.
 */
export const PATHS: Record<ModuleKey, string> & { salesReports: string } = {
  dashboard: '/',
  reports: '/reports',
  orders: '/orders',
  shipments: '/shipments',
  deliveries: '/deliveries',
  inventory: '/inventory',
  sales: '/sales',
  salesReports: '/sales-reports',
  breweries: '/breweries',
  suppliers: '/suppliers',
  clients: '/clients',
  drivers: '/drivers',
  vehicles: '/vehicles',
  users: '/users',
};

export const LOGIN_PATH = '/login';
