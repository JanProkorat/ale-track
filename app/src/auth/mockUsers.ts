import { type CurrentUser } from './types';
import { allPerms, makePerms } from './permissions';

// P1 stand-in users so the shell, routing and the permission system are
// demonstrable before the backend/login API is wired (P3). These also back
// the "demo účty" quick-login chips.
export const DEMO_USERS: CurrentUser[] = [
  {
    id: 'u-admin',
    userName: 'admin',
    firstName: 'Jan',
    lastName: 'Prokorát',
    roles: ['Admin'],
    perms: allPerms('edit'),
  },
  {
    id: 'u-dispecer',
    userName: 'dispecer',
    firstName: 'Eva',
    lastName: 'Dvořáková',
    roles: ['User'],
    perms: makePerms({
      orders: 'edit',
      shipments: 'edit',
      deliveries: 'edit',
      clients: 'edit',
      inventory: 'edit',
      breweries: 'view',
      drivers: 'view',
      vehicles: 'view',
    }),
  },
  {
    id: 'u-sklad',
    userName: 'sklad',
    firstName: 'Martin',
    lastName: 'Kolář',
    roles: ['User'],
    perms: makePerms({
      inventory: 'edit',
      deliveries: 'edit',
      breweries: 'view',
      orders: 'view',
      shipments: 'view',
      vehicles: 'view',
    }),
  },
];

export function findDemoUser(userName: string): CurrentUser | undefined {
  return DEMO_USERS.find((u) => u.userName.toLowerCase() === userName.trim().toLowerCase());
}
