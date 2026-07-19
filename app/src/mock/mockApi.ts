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
  ModulePermissionDto,
  type CreateUserDto,
  type UpdateUserDto,
  InventorySectionDto,
  InventoryItemListItemDto,
  ProductListItemDto,
  type IInventoryItemListItemDto,
  type CreateInventoryItemDto,
  type UpdateInventoryItemDto,
  DriverListItemDto,
  DriverDto,
  DriverAvailabilityListItemDto,
  DriverAvailabilityDto,
  type CreateDriverDto,
  type UpdateDriverDto,
  NumberOfRecordsInEachModuleDto,
  BreweryListItemDto,
  BreweryDto,
  AddressDto,
  BreweryProductListItemDto,
  ProductDto,
  ReminderListItemDto,
  type CreateBreweryDto,
  type UpdateBreweryDto,
  type CreateProductsDto,
  type UpdateProductDto,
  type CreateReminderDto,
  type UpdateReminderDto,
  type SetBreweryReminderResolvedDateRequest,
  type IAddressDto,
} from 'src/generated/api-client';
import {
  db,
  mockId,
  mockDelay,
  MockNotFoundError,
  type MockDriverAvailability,
  type MockAddress,
  type MockReminder,
} from './db';

/** Case-insensitive substring match for demo-side list search. */
function matches(haystack: string | undefined, needle: string | undefined): boolean {
  if (!needle) return true;
  return (haystack ?? '').toLowerCase().includes(needle.toLowerCase());
}

function toAddressDto(a: MockAddress): AddressDto {
  return new AddressDto(a as IAddressDto);
}
function fromAddressDto(a: IAddressDto | undefined): MockAddress | undefined {
  if (!a) return undefined;
  return {
    streetName: a.streetName, streetNumber: a.streetNumber, city: a.city, zip: a.zip,
    country: a.country, latitude: a.latitude, longitude: a.longitude,
  };
}
function reminderToDto(r: MockReminder): ReminderListItemDto {
  return new ReminderListItemDto({
    id: r.id, name: r.name, description: r.description, occurrenceDate: r.occurrenceDate,
    isResolved: r.isResolved, type: r.type,
  });
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
            permissions: (u.permissions ?? []).map((p) => new ModulePermissionDto(p)),
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
      permissions: data.permissions,
    });
    return mockDelay(id);
  },
  updateUserEndpoint(id: string, data: UpdateUserDto) {
    const u = db.users.find((x) => x.id === id);
    if (!u) return Promise.reject(new MockNotFoundError('Uživatel'));
    u.firstName = data.firstName;
    u.lastName = data.lastName;
    u.userRoles = data.userRoles;
    u.permissions = data.permissions;
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

  // ---- Drivers (Řidiči) ------------------------------------------------------
  getDriversListEndpoint(parameters: { [key: string]: string }) {
    const search = parameters?.['search'] ?? parameters?.['Search'];
    const rows = db.drivers
      .filter((d) => matches(d.firstName, search) || matches(d.lastName, search))
      .map(
        (d) =>
          new DriverListItemDto({
            id: d.id,
            firstName: d.firstName,
            lastName: d.lastName,
            phoneNumber: d.phoneNumber,
            color: d.color,
            availableDates: d.availableDates.map((a) => new DriverAvailabilityListItemDto(a)),
          })
      );
    return mockDelay(rows);
  },
  getDriverDetailEndpoint(id: string) {
    const d = db.drivers.find((x) => x.id === id);
    if (!d) return Promise.reject(new MockNotFoundError('Řidič'));
    return mockDelay(
      new DriverDto({
        id: d.id,
        firstName: d.firstName,
        lastName: d.lastName,
        phoneNumber: d.phoneNumber,
        color: d.color,
        availableDates: d.availableDates.map((a) => new DriverAvailabilityDto(a)),
      })
    );
  },
  createDriverEndpoint(data: CreateDriverDto) {
    const id = mockId('drv');
    const availableDates: MockDriverAvailability[] = (data.availableDates ?? [])
      .filter((a) => a.from && a.until)
      .map((a) => ({ from: a.from!, until: a.until! }));
    db.drivers.unshift({
      id,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      color: data.color,
      availableDates,
    });
    return mockDelay(id);
  },
  updateDriverEndpoint(id: string, data: UpdateDriverDto) {
    const d = db.drivers.find((x) => x.id === id);
    if (!d) return Promise.reject(new MockNotFoundError('Řidič'));
    d.firstName = data.firstName;
    d.lastName = data.lastName;
    d.phoneNumber = data.phoneNumber;
    d.color = data.color;
    d.availableDates = (data.availableDates ?? [])
      .filter((a) => a.from && a.until)
      .map((a) => ({ from: a.from!, until: a.until! }));
    return mockDelay(id);
  },
  deleteDriverEndpoint(id: string) {
    const i = db.drivers.findIndex((x) => x.id === id);
    if (i >= 0) db.drivers.splice(i, 1);
    return mockDelay(id);
  },

  // ---- Reports (dashboard KPI tiles) ----------------------------------------
  getNumberOfRecordsInEachModuleEndpoint() {
    const inventoryItemsCount = db.inventory.reduce((sum, section) => sum + section.items.length, 0);
    const breweriesCount = new Set(db.products.map((p) => p.breweryName)).size;
    return mockDelay(
      new NumberOfRecordsInEachModuleDto({
        // Not yet backed by a demo collection — plausible fixed numbers per spec.
        clientsCount: 24,
        ordersCount: 37,
        outgoingShipmentsCount: 9,
        productDeliveriesCount: 6,
        // Derived from the in-memory demo store.
        breweriesCount,
        inventoryItemsCount,
        driversCount: db.drivers.length,
        vehiclesCount: db.vehicles.length,
        usersCount: db.users.length,
      })
    );
  },

  // ---- Breweries ------------------------------------------------------------
  getBreweriesListEndpoint(parameters: { [key: string]: string }) {
    const search = parameters?.['search'] ?? parameters?.['Search'];
    const rows = db.breweries
      .filter((b) => matches(b.name, search))
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((b) => new BreweryListItemDto({ id: b.id, name: b.name, displayOrder: b.displayOrder, color: b.color }));
    return mockDelay(rows);
  },
  getBreweryDetailEndpoint(id: string) {
    const b = db.breweries.find((x) => x.id === id);
    if (!b) return Promise.reject(new MockNotFoundError('Pivovar'));
    return mockDelay(
      new BreweryDto({
        id: b.id, name: b.name, color: b.color,
        officialAddress: toAddressDto(b.officialAddress),
        contactAddress: b.contactAddress ? toAddressDto(b.contactAddress) : undefined,
      })
    );
  },
  createBreweryEndpoint(data: CreateBreweryDto) {
    const id = mockId('brw');
    const displayOrder = db.breweries.reduce((m, b) => Math.max(m, b.displayOrder), 0) + 1;
    db.breweries.push({
      id, name: data.name, color: data.color, displayOrder,
      officialAddress: fromAddressDto(data.officialAddress)!,
      contactAddress: fromAddressDto(data.contactAddress),
    });
    return mockDelay(id);
  },
  updateBreweryEndpoint(id: string, data: UpdateBreweryDto) {
    const b = db.breweries.find((x) => x.id === id);
    if (!b) return Promise.reject(new MockNotFoundError('Pivovar'));
    b.name = data.name;
    b.color = data.color;
    if (data.officialAddress) b.officialAddress = fromAddressDto(data.officialAddress)!;
    b.contactAddress = fromAddressDto(data.contactAddress);
    // Keep denormalized product.breweryName in sync.
    db.products.forEach((p) => { if (p.breweryId === id) p.breweryName = data.name; });
    return mockDelay(id);
  },
  deleteBreweryEndpoint(id: string) {
    const i = db.breweries.findIndex((x) => x.id === id);
    if (i >= 0) db.breweries.splice(i, 1);
    db.products = db.products.filter((p) => p.breweryId !== id);
    db.breweryReminders = db.breweryReminders.filter((r) => r.ownerId !== id);
    return mockDelay(id);
  },

  // ---- Ceník (per-brewery products) -----------------------------------------
  getBreweryProductsListEndpoint(id: string, parameters: { [key: string]: string }) {
    const search = parameters?.['search'] ?? parameters?.['Search'];
    const rows = db.products
      .filter((p) => p.breweryId === id && matches(p.name, search))
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map(
        (p) =>
          new BreweryProductListItemDto({
            id: p.id, name: p.name, description: p.description, kind: p.kind, type: p.type,
            alcoholPercentage: p.alcoholPercentage, platoDegree: p.platoDegree, packageSize: p.packageSize,
            priceWithVat: p.priceWithVat, priceForUnitWithVat: p.priceForUnitWithVat,
            priceForUnitWithoutVat: p.priceForUnitWithoutVat, weight: p.weight, displayOrder: p.displayOrder,
          })
      );
    return mockDelay(rows);
  },
  getProductDetailEndpoint(id: string) {
    const p = db.products.find((x) => x.id === id);
    if (!p) return Promise.reject(new MockNotFoundError('Produkt'));
    return mockDelay(
      new ProductDto({
        id: p.id, name: p.name, description: p.description, kind: p.kind, type: p.type,
        alcoholPercentage: p.alcoholPercentage, platoDegree: p.platoDegree, packageSize: p.packageSize,
        priceWithVat: p.priceWithVat, priceForUnitWithVat: p.priceForUnitWithVat,
        priceForUnitWithoutVat: p.priceForUnitWithoutVat, weight: p.weight,
      })
    );
  },
  createProductsEndpoint(id: string, data: CreateProductsDto) {
    const brewery = db.breweries.find((x) => x.id === id);
    const nextOrder = db.products.filter((p) => p.breweryId === id).reduce((m, p) => Math.max(m, p.displayOrder ?? 0), 0);
    (data.products ?? []).forEach((prod, i) => {
      db.products.push({
        id: mockId('prod'), name: prod.name, description: prod.description, kind: prod.kind, type: prod.type,
        alcoholPercentage: prod.alcoholPercentage, platoDegree: prod.platoDegree, packageSize: prod.packageSize,
        priceWithVat: prod.priceWithVat, priceForUnitWithVat: prod.priceForUnitWithVat,
        priceForUnitWithoutVat: prod.priceForUnitWithoutVat,
        breweryName: brewery?.name, breweryId: id, breweryDisplayOrder: brewery?.displayOrder,
        displayOrder: nextOrder + i + 1,
      });
    });
    return mockDelay(id);
  },
  updateProductEndpoint(id: string, data: UpdateProductDto) {
    const p = db.products.find((x) => x.id === id);
    if (!p) return Promise.reject(new MockNotFoundError('Produkt'));
    Object.assign(p, {
      name: data.name, description: data.description, kind: data.kind, type: data.type,
      alcoholPercentage: data.alcoholPercentage, platoDegree: data.platoDegree, packageSize: data.packageSize,
      priceWithVat: data.priceWithVat, priceForUnitWithVat: data.priceForUnitWithVat,
      priceForUnitWithoutVat: data.priceForUnitWithoutVat,
    });
    return mockDelay(id);
  },
  deleteProductEndpoint(id: string) {
    const i = db.products.findIndex((x) => x.id === id);
    if (i >= 0) db.products.splice(i, 1);
    return mockDelay(id);
  },

  // ---- Brewery reminders ----------------------------------------------------
  getBreweryRemindersListEndpoint(id: string) {
    const rows = db.breweryReminders.filter((r) => r.ownerId === id).map(reminderToDto);
    return mockDelay(rows);
  },
  createBreweryReminderEndpoint(id: string, data: CreateReminderDto) {
    const rid = mockId('rem');
    db.breweryReminders.push({
      id: rid, ownerId: id, name: data.name, description: data.description, type: data.type,
      occurrenceDate: data.occurrenceDate, numberOfDaysToRemindBefore: data.numberOfDaysToRemindBefore,
      isResolved: false,
    });
    return mockDelay(rid);
  },
  updateBreweryReminderEndpoint(id: string, data: UpdateReminderDto) {
    const r = db.breweryReminders.find((x) => x.id === id);
    if (!r) return Promise.reject(new MockNotFoundError('Připomínka'));
    Object.assign(r, {
      name: data.name, description: data.description, type: data.type, occurrenceDate: data.occurrenceDate,
      numberOfDaysToRemindBefore: data.numberOfDaysToRemindBefore,
      resolvedDate: data.resolvedDate, isResolved: data.resolvedDate != null,
    });
    return mockDelay(id);
  },
  setBreweryReminderResolvedDateEndpoint(id: string, req: SetBreweryReminderResolvedDateRequest) {
    const r = db.breweryReminders.find((x) => x.id === id);
    if (!r) return Promise.reject(new MockNotFoundError('Připomínka'));
    r.resolvedDate = req.resolvedDate;
    r.isResolved = req.resolvedDate != null;
    return mockDelay(id);
  },
  deleteBreweryReminderEndpoint(id: string) {
    const i = db.breweryReminders.findIndex((x) => x.id === id);
    if (i >= 0) db.breweryReminders.splice(i, 1);
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
