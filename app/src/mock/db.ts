// In-memory dataset backing DEMO sessions ("Prohlédnout bez připojení").
// Demo CRUD reads/writes these arrays; changes live for the session only and
// reset on reload. Real (logged-in) sessions never touch this — they hit the
// live API. Each module appends its collection + seed here as it's built.

import {
  type IVehicleDto,
  type IUserListItemDto,
  type IProductListItemDto,
  type IInventoryItemListItemDto,
  UserRoleType,
  ProductKind,
  ProductType,
} from 'src/generated/api-client';

export interface MockDb {
  vehicles: IVehicleDto[];
  users: IUserListItemDto[];
  products: IProductListItemDto[];
  inventory: MockInventorySection[];
}

// Note: the generated `IInventorySectionDto.items` is typed as the concrete
// `InventoryItemListItemDto` class (an NSwag quirk), which doesn't suit a
// plain-object demo store. This local shape mirrors it with plain data.
export interface MockInventorySection {
  id?: string;
  name?: string;
  items: IInventoryItemListItemDto[];
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

// Three breweries; ~3-4 products each, priced per package (keg/crate/bottle)
// with a per-liter unit price derived from `packageSize`.
const PRODUCTS_SEED: IProductListItemDto[] = [
  // Pivovar Únětice
  {
    id: 'prod-0001', name: 'Únětický Ležák 12°', kind: ProductKind.Keg, type: ProductType.PaleLager,
    alcoholPercentage: 5, platoDegree: 12, packageSize: 30, priceWithVat: 1050,
    priceForUnitWithVat: 35, priceForUnitWithoutVat: 28.93,
    breweryName: 'Pivovar Únětice', breweryId: 'brw-0001', breweryDisplayOrder: 1, displayOrder: 1,
  },
  {
    id: 'prod-0002', name: 'Únětické Světlé výčepní 10°', kind: ProductKind.Keg, type: ProductType.PaleDraftBeer,
    alcoholPercentage: 4.1, platoDegree: 10, packageSize: 50, priceWithVat: 1500,
    priceForUnitWithVat: 30, priceForUnitWithoutVat: 24.79,
    breweryName: 'Pivovar Únětice', breweryId: 'brw-0001', breweryDisplayOrder: 1, displayOrder: 2,
  },
  {
    id: 'prod-0003', name: 'Únětický Ležák 12°', kind: ProductKind.Bottle, type: ProductType.PaleLager,
    alcoholPercentage: 5, platoDegree: 12, packageSize: 0.5, priceWithVat: 28,
    priceForUnitWithVat: 56, priceForUnitWithoutVat: 46.28,
    breweryName: 'Pivovar Únětice', breweryId: 'brw-0001', breweryDisplayOrder: 1, displayOrder: 3,
  },
  // Pivovar Kácov
  {
    id: 'prod-0004', name: 'Kácovský Bavor 12°', kind: ProductKind.Keg, type: ProductType.PaleLager,
    alcoholPercentage: 5, platoDegree: 12, packageSize: 30, priceWithVat: 980,
    priceForUnitWithVat: 32.67, priceForUnitWithoutVat: 27,
    breweryName: 'Pivovar Kácov', breweryId: 'brw-0002', breweryDisplayOrder: 2, displayOrder: 1,
  },
  {
    id: 'prod-0005', name: 'Kácovský Tmavý 13°', kind: ProductKind.Keg, type: ProductType.DarkLager,
    alcoholPercentage: 5.2, platoDegree: 13, packageSize: 30, priceWithVat: 1100,
    priceForUnitWithVat: 36.67, priceForUnitWithoutVat: 30.31,
    breweryName: 'Pivovar Kácov', breweryId: 'brw-0002', breweryDisplayOrder: 2, displayOrder: 2,
  },
  {
    id: 'prod-0006', name: 'Kácovský Bavor 12°', kind: ProductKind.Can, type: ProductType.PaleLager,
    alcoholPercentage: 5, platoDegree: 12, packageSize: 0.5, priceWithVat: 32,
    priceForUnitWithVat: 64, priceForUnitWithoutVat: 52.89,
    breweryName: 'Pivovar Kácov', breweryId: 'brw-0002', breweryDisplayOrder: 2, displayOrder: 3,
  },
  {
    id: 'prod-0007', name: 'Kácovský Radler', kind: ProductKind.Can, type: ProductType.Radler,
    alcoholPercentage: 2, packageSize: 0.5, priceWithVat: 30,
    priceForUnitWithVat: 60, priceForUnitWithoutVat: 49.59,
    breweryName: 'Pivovar Kácov', breweryId: 'brw-0002', breweryDisplayOrder: 2, displayOrder: 4,
  },
  // Pivovar Rohozec
  {
    id: 'prod-0008', name: 'Rohozec Ležák 12°', kind: ProductKind.Keg, type: ProductType.PaleLager,
    alcoholPercentage: 5, platoDegree: 12, packageSize: 50, priceWithVat: 1650,
    priceForUnitWithVat: 33, priceForUnitWithoutVat: 27.27,
    breweryName: 'Pivovar Rohozec', breweryId: 'brw-0003', breweryDisplayOrder: 3, displayOrder: 1,
  },
  {
    id: 'prod-0009', name: 'Rohozec Klasik 11°', kind: ProductKind.Keg, type: ProductType.PaleDraftBeer,
    alcoholPercentage: 4.3, platoDegree: 11, packageSize: 30, priceWithVat: 950,
    priceForUnitWithVat: 31.67, priceForUnitWithoutVat: 26.17,
    breweryName: 'Pivovar Rohozec', breweryId: 'brw-0003', breweryDisplayOrder: 3, displayOrder: 2,
  },
  {
    id: 'prod-0010', name: 'Rohozec Nealko', kind: ProductKind.Bottle, type: ProductType.NonAlcoholicBeer,
    alcoholPercentage: 0.5, packageSize: 0.5, priceWithVat: 22,
    priceForUnitWithVat: 44, priceForUnitWithoutVat: 36.36,
    breweryName: 'Pivovar Rohozec', breweryId: 'brw-0003', breweryDisplayOrder: 3, displayOrder: 3,
  },
];

// One section per brewery; items mirror a subset of that brewery's products
// with a stocked quantity and (sometimes) a note.
const INVENTORY_SEED: MockInventorySection[] = [
  {
    id: 'sec-0001',
    name: 'Pivovar Únětice',
    items: [
      {
        id: 'invi-0001', name: 'Únětický Ležák 12°', productId: 'prod-0001', quantity: 12,
        kind: ProductKind.Keg, type: ProductType.PaleLager, alcoholPercentage: 5, platoDegree: 12,
        packageSize: 30, priceWithVat: 1050, priceForUnitWithVat: 35, priceForUnitWithoutVat: 28.93,
      },
      {
        id: 'invi-0002', name: 'Únětické Světlé výčepní 10°', productId: 'prod-0002', quantity: 8,
        kind: ProductKind.Keg, type: ProductType.PaleDraftBeer, alcoholPercentage: 4.1, platoDegree: 10,
        packageSize: 50, priceWithVat: 1500, priceForUnitWithVat: 30, priceForUnitWithoutVat: 24.79,
      },
      {
        id: 'invi-0003', name: 'Únětický Ležák 12°', productId: 'prod-0003', quantity: 240,
        kind: ProductKind.Bottle, type: ProductType.PaleLager, alcoholPercentage: 5, platoDegree: 12,
        packageSize: 0.5, priceWithVat: 28, priceForUnitWithVat: 56, priceForUnitWithoutVat: 46.28,
        note: 'Doplnit do pátku',
      },
    ],
  },
  {
    id: 'sec-0002',
    name: 'Pivovar Kácov',
    items: [
      {
        id: 'invi-0004', name: 'Kácovský Bavor 12°', productId: 'prod-0004', quantity: 20,
        kind: ProductKind.Keg, type: ProductType.PaleLager, alcoholPercentage: 5, platoDegree: 12,
        packageSize: 30, priceWithVat: 980, priceForUnitWithVat: 32.67, priceForUnitWithoutVat: 27,
      },
      {
        id: 'invi-0005', name: 'Kácovský Tmavý 13°', productId: 'prod-0005', quantity: 10,
        kind: ProductKind.Keg, type: ProductType.DarkLager, alcoholPercentage: 5.2, platoDegree: 13,
        packageSize: 30, priceWithVat: 1100, priceForUnitWithVat: 36.67, priceForUnitWithoutVat: 30.31,
      },
      {
        id: 'invi-0006', name: 'Kácovský Bavor 12°', productId: 'prod-0006', quantity: 150,
        kind: ProductKind.Can, type: ProductType.PaleLager, alcoholPercentage: 5, platoDegree: 12,
        packageSize: 0.5, priceWithVat: 32, priceForUnitWithVat: 64, priceForUnitWithoutVat: 52.89,
      },
    ],
  },
  {
    id: 'sec-0003',
    name: 'Pivovar Rohozec',
    items: [
      {
        id: 'invi-0007', name: 'Rohozec Ležák 12°', productId: 'prod-0008', quantity: 15,
        kind: ProductKind.Keg, type: ProductType.PaleLager, alcoholPercentage: 5, platoDegree: 12,
        packageSize: 50, priceWithVat: 1650, priceForUnitWithVat: 33, priceForUnitWithoutVat: 27.27,
      },
      {
        id: 'invi-0008', name: 'Rohozec Klasik 11°', productId: 'prod-0009', quantity: 25,
        kind: ProductKind.Keg, type: ProductType.PaleDraftBeer, alcoholPercentage: 4.3, platoDegree: 11,
        packageSize: 30, priceWithVat: 950, priceForUnitWithVat: 31.67, priceForUnitWithoutVat: 26.17,
      },
      {
        id: 'invi-0009', name: 'Rohozec Nealko', productId: 'prod-0010', quantity: 80,
        kind: ProductKind.Bottle, type: ProductType.NonAlcoholicBeer, alcoholPercentage: 0.5,
        packageSize: 0.5, priceWithVat: 22, priceForUnitWithVat: 44, priceForUnitWithoutVat: 36.36,
        note: 'Nízký odbyt, sledovat expiraci',
      },
    ],
  },
];

export const db: MockDb = {
  vehicles: structuredClone(VEHICLES_SEED),
  users: structuredClone(USERS_SEED),
  products: structuredClone(PRODUCTS_SEED),
  inventory: structuredClone(INVENTORY_SEED),
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
