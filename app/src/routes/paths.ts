import { type ModuleKey } from 'src/auth/permissions';

export const PATHS: Record<ModuleKey, string> = {
  dashboard: '/',
  orders: '/objednavky',
  shipments: '/vyvozy',
  deliveries: '/dovozy',
  inventory: '/sklad',
  breweries: '/pivovary',
  clients: '/klienti',
  drivers: '/ridici',
  vehicles: '/vozy',
  users: '/uzivatele',
};

export const LOGIN_PATH = '/prihlaseni';
