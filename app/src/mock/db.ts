// In-memory dataset backing DEMO sessions ("Prohlédnout bez připojení").
// Demo CRUD reads/writes these arrays; changes live for the session only and
// reset on reload. Real (logged-in) sessions never touch this — they hit the
// live API. Each module appends its collection + seed here as it's built.

import { type IVehicleDto, type IUserListItemDto, UserRoleType } from 'src/generated/api-client';

export interface MockDb {
  vehicles: IVehicleDto[];
  users: IUserListItemDto[];
}

const VEHICLES_SEED: IVehicleDto[] = [
  { id: 'veh-0001', name: 'Mercedes Sprinter (3S1 4472)', maxWeight: 1500 },
  { id: 'veh-0002', name: 'VW Crafter (3S2 8810)', maxWeight: 1400 },
  { id: 'veh-0003', name: 'Iveco Daily (2AB 1290)', maxWeight: 3500 },
  { id: 'veh-0004', name: 'Ford Transit (5U9 6631)', maxWeight: 1100 },
];

const USERS_SEED: IUserListItemDto[] = [
  { id: 'usr-0001', firstName: undefined, lastName: undefined, userName: 'admin', userRoles: [UserRoleType.Admin] },
  { id: 'usr-0002', firstName: 'Jana', lastName: 'Nováková', userName: 'jana.novakova', userRoles: [UserRoleType.User] },
  { id: 'usr-0003', firstName: 'Petr', lastName: 'Svoboda', userName: 'petr.svoboda', userRoles: [UserRoleType.User] },
  { id: 'usr-0004', firstName: 'Lucie', lastName: 'Dvořáková', userName: 'lucie.dvorakova', userRoles: [UserRoleType.User] },
  { id: 'usr-0005', firstName: 'Tomáš', lastName: 'Procházka', userName: 'tomas.prochazka', userRoles: [UserRoleType.User] },
];

export const db: MockDb = {
  vehicles: structuredClone(VEHICLES_SEED),
  users: structuredClone(USERS_SEED),
};

/** New id for demo-created records. */
export function mockId(prefix = 'demo'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10);
  return `${prefix}-${rand}`;
}

/** Simulate a little network latency so loading states are exercised in demo. */
export function mockDelay<T>(value: T, ms = 140): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export class MockNotFoundError extends Error {
  constructor(what = 'Záznam') {
    super(`${what} nebyl nalezen (demo).`);
    this.name = 'MockNotFoundError';
  }
}
