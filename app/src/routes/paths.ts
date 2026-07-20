import { type ModuleKey } from 'src/auth/permissions';

export const PATHS: Record<ModuleKey, string> = {
  dashboard: '/',
  orders: '/orders',
  shipments: '/shipments',
  deliveries: '/deliveries',
  inventory: '/inventory',
  breweries: '/breweries',
  clients: '/clients',
  drivers: '/drivers',
  vehicles: '/vehicles',
  users: '/users',
};

export const LOGIN_PATH = '/login';
