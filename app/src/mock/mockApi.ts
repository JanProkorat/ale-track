// Demo-mode implementation of the generated API client. Only the endpoints the
// UI actually calls are implemented; anything else throws a clear error so a
// missing demo slice is obvious during development rather than silently empty.
//
// Typed as the generated `IClient` so every implemented method's signature is
// checked against the real client — demo and live can never drift apart.

import {
  type IClient,
  VehicleListItemDto,
  VehicleDto,
  type CreateVehicleDto,
  type UpdateVehicleDto,
  UserListItemDto,
  type CreateUserDto,
  type UpdateUserDto,
  InventorySectionDto,
  InventoryItemListItemDto,
  ProductListItemDto,
  type IInventoryItemListItemDto,
  type CreateInventoryItemDto,
  type UpdateInventoryItemDto,
} from 'src/generated/api-client';
import { db, mockId, mockDelay, MockNotFoundError } from './db';

/** Case-insensitive substring match for demo-side list search. */
function matches(haystack: string | undefined, needle: string | undefined): boolean {
  if (!needle) return true;
  return (haystack ?? '').toLowerCase().includes(needle.toLowerCase());
}

const impl: Partial<IClient> = {
  // ---- Vehicles -----------------------------------------------------------
  getVehiclesListEndpoint(parameters: { [key: string]: string }) {
    const search = parameters?.['search'] ?? parameters?.['Search'];
    const rows = db.vehicles
      .filter((v) => matches(v.name, search))
      .map((v) => new VehicleListItemDto({ id: v.id, name: v.name, maxWeight: v.maxWeight }));
    return mockDelay(rows);
  },
  getVehicleDetailEndpoint(id: string) {
    const v = db.vehicles.find((x) => x.id === id);
    if (!v) return Promise.reject(new MockNotFoundError('Vůz'));
    return mockDelay(new VehicleDto({ ...v }));
  },
  createVehicleEndpoint(data: CreateVehicleDto) {
    const id = mockId('veh');
    db.vehicles.unshift({ id, name: data.name, maxWeight: data.maxWeight });
    return mockDelay(id);
  },
  updateVehicleEndpoint(id: string, data: UpdateVehicleDto) {
    const v = db.vehicles.find((x) => x.id === id);
    if (!v) return Promise.reject(new MockNotFoundError('Vůz'));
    v.name = data.name;
    v.maxWeight = data.maxWeight;
    return mockDelay(id);
  },
  deleteVehicleEndpoint(id: string) {
    const i = db.vehicles.findIndex((x) => x.id === id);
    if (i >= 0) db.vehicles.splice(i, 1);
    return mockDelay(id);
  },

  // ---- Users ---------------------------------------------------------------
  getUserListEndpoint(parameters: { [key: string]: string }) {
    const search = parameters?.['search'] ?? parameters?.['Search'];
    const rows = db.users
      .filter(
        (u) =>
          matches(u.firstName, search) || matches(u.lastName, search) || matches(u.userName, search)
      )
      .map(
        (u) =>
          new UserListItemDto({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            userName: u.userName,
            userRoles: u.userRoles,
          })
      );
    return mockDelay(rows);
  },
  createUserEndpoint(data: CreateUserDto) {
    const id = mockId('usr');
    db.users.unshift({
      id,
      firstName: data.firstName,
      lastName: data.lastName,
      userName: data.userName,
      userRoles: data.userRoles,
    });
    return mockDelay(id);
  },
  updateUserEndpoint(id: string, data: UpdateUserDto) {
    const u = db.users.find((x) => x.id === id);
    if (!u) return Promise.reject(new MockNotFoundError('Uživatel'));
    u.firstName = data.firstName;
    u.lastName = data.lastName;
    u.userRoles = data.userRoles;
    return mockDelay(id);
  },
  deleteUserEndpoint(id: string) {
    const i = db.users.findIndex((x) => x.id === id);
    if (i >= 0) db.users.splice(i, 1);
    return mockDelay(id);
  },

  // ---- Products (read-only picker source) -----------------------------------
  getProductsListEndpoint(parameters: { [key: string]: string }) {
    const search = parameters?.['search'] ?? parameters?.['Search'];
    const rows = db.products
      .filter((p) => matches(p.name, search) || matches(p.breweryName, search))
      .map((p) => new ProductListItemDto(p));
    return mockDelay(rows);
  },

  // ---- Inventory (Sklad) -----------------------------------------------------
  getInventoryItemsListEndpoint(parameters: { [key: string]: string }) {
    const search = parameters?.['search'] ?? parameters?.['Search'];
    const sections = db.inventory.map((s) => {
      const items = search ? s.items.filter((i) => matches(i.name, search)) : s.items;
      return new InventorySectionDto({
        id: s.id,
        name: s.name,
        items: items.map((i) => new InventoryItemListItemDto(i)),
      });
    });
    const rows = search ? sections.filter((s) => (s.items ?? []).length > 0) : sections;
    return mockDelay(rows);
  },
  createInventoryItemEndpoint(data: CreateInventoryItemDto) {
    const product = db.products.find((p) => p.id === data.productId);
    if (!product) return Promise.reject(new MockNotFoundError('Produkt'));
    const id = mockId('inv');
    const item: IInventoryItemListItemDto = {
      id,
      name: data.name || product.name,
      productId: product.id,
      quantity: data.quantity,
      kind: product.kind,
      type: product.type,
      alcoholPercentage: product.alcoholPercentage,
      platoDegree: product.platoDegree,
      packageSize: product.packageSize,
      priceWithVat: product.priceWithVat,
      priceForUnitWithVat: product.priceForUnitWithVat,
      priceForUnitWithoutVat: product.priceForUnitWithoutVat,
      note: data.note,
    };
    let section = db.inventory.find((s) => s.name === product.breweryName);
    if (!section) {
      section = { id: mockId('sec'), name: product.breweryName, items: [] };
      db.inventory.push(section);
    }
    section.items.push(item);
    return mockDelay(id);
  },
  updateInventoryItemEndpoint(id: string, data: UpdateInventoryItemDto) {
    for (const section of db.inventory) {
      const item = section.items.find((i) => i.id === id);
      if (item) {
        item.quantity = data.quantity;
        item.note = data.note;
        if (data.name) item.name = data.name;
        return mockDelay(id);
      }
    }
    return Promise.reject(new MockNotFoundError('Skladová položka'));
  },
  deleteInventoryItemEndpoint(id: string) {
    for (const section of db.inventory) {
      const i = section.items.findIndex((x) => x.id === id);
      if (i >= 0) {
        section.items.splice(i, 1);
        return mockDelay(id);
      }
    }
    return mockDelay(id);
  },
};

/** Proxy that serves implemented demo endpoints and throws a clear error for
 * any endpoint not yet backed by a demo slice. */
export const mockApi: IClient = new Proxy(impl as IClient, {
  get(target, prop: string | symbol) {
    const fn = (target as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof fn === 'function') return fn.bind(target);
    return () =>
      Promise.reject(
        new Error(`Demo režim: endpoint "${String(prop)}" zatím není k dispozici.`)
      );
  },
});
