import { type ModuleKey } from 'src/auth/permissions';

// `userRoles` is not a nav module — it is a sub-route of `users` for the
// role-capability admin screen — hence the intersection rather than adding
// it as a ModuleKey.
export const PATHS: Record<ModuleKey, string> & { userRoles: string } = {
  dashboard: '/',
  reports: '/reports',
  orders: '/orders',
  shipments: '/shipments',
  deliveries: '/deliveries',
  inventory: '/inventory',
  breweries: '/breweries',
  clients: '/clients',
  drivers: '/drivers',
  vehicles: '/vehicles',
  users: '/users',
  userRoles: '/users/roles',
};

export const LOGIN_PATH = '/login';
