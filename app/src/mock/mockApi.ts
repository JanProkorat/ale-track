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
  ClientListItemDto,
  ClientDto,
  ClientContactDto,
  NoteDto,
  type CreateClientDto,
  type UpdateClientDto,
  type IClientContactDto,
  type CreateNoteDto,
  type SetClientReminderResolvedDateRequest,
  OrderListItemDto,
  OrderDto,
  OrderItemDto,
  ClientInfoDto,
  OrderState,
  GroupedProductHistoryDto,
  BreweryGroupDto,
  KindGroupDto,
  PackageGroupDto,
  ProductKind,
  type CreateOrderDto,
  type UpdateOrderDto,
  type ICreateOrderItemDto,
  type IUpdateOrderItemDto,
  type IProductListItemDto,
} from 'src/generated/api-client';
import {
  db,
  mockId,
  mockDelay,
  MockNotFoundError,
  type MockDriverAvailability,
  type MockAddress,
  type MockReminder,
  type MockClient,
  type MockClientContact,
  type MockOrder,
  type MockOrderItem,
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
function contactToDto(c: MockClientContact): ClientContactDto {
  return new ClientContactDto(c as IClientContactDto);
}
function fromContactDto(c: IClientContactDto): MockClientContact {
  return { type: c.type ?? 0, description: c.description, value: c.value ?? '' };
}
function clientToDetailDto(c: MockClient): ClientDto {
  return new ClientDto({
    id: c.id, name: c.name, businessName: c.businessName, region: c.region,
    officialAddress: toAddressDto(c.officialAddress),
    contactAddress: c.contactAddress ? toAddressDto(c.contactAddress) : undefined,
    contacts: c.contacts.map(contactToDto),
  });
}

// ---- Orders helpers ---------------------------------------------------------
// The order item store only holds ids/quantity; product name and the
// brewery/display ordering hints on OrderItemDto are resolved by joining
// against db.products on the way out (same denormalization pattern used by
// inventory items elsewhere in this file).
function orderItemToDto(oi: MockOrderItem): OrderItemDto {
  const p = db.products.find((x) => x.id === oi.productId);
  return new OrderItemDto({
    id: oi.id,
    productId: oi.productId,
    productName: p?.name ?? '(smazaný produkt)',
    quantity: oi.quantity,
    reminderState: oi.reminderState,
    breweryDisplayOrder: p?.breweryDisplayOrder,
    displayOrder: p?.displayOrder,
  });
}
function orderToListDto(o: MockOrder): OrderListItemDto {
  const c = db.clients.find((x) => x.id === o.clientId);
  return new OrderListItemDto({
    id: o.id, state: o.state, requiredDeliveryDate: o.requiredDeliveryDate,
    clientName: c?.name ?? '—',
  });
}
function orderToDetailDto(o: MockOrder): OrderDto {
  const c = db.clients.find((x) => x.id === o.clientId);
  return new OrderDto({
    id: o.id,
    client: new ClientInfoDto({ id: c?.id, name: c?.name }),
    state: o.state,
    requiredDeliveryDate: o.requiredDeliveryDate,
    actualDeliveryDate: o.actualDeliveryDate,
    createdDate: o.createdDate,
    orderItems: o.items.map(orderItemToDto),
  });
}
function toMockOrderItems(items: (ICreateOrderItemDto | IUpdateOrderItemDto)[] | undefined): MockOrderItem[] {
  return (items ?? []).map((it) => ({
    id: mockId('oi'),
    productId: it.productId!,
    quantity: it.quantity ?? 1,
    reminderState: it.reminderState,
  }));
}
/** Groups the full product catalog into brewery -> kind -> package size, the
 * shape `GroupedProductHistoryDto.breweries` needs for the "browse" tab of the
 * order editor's catalog. */
function buildBreweryGroups(products: IProductListItemDto[]): BreweryGroupDto[] {
  const byBrewery = new Map<string, { breweryId: string; breweryName: string; order: number; products: IProductListItemDto[] }>();
  for (const p of products) {
    const key = p.breweryId ?? '';
    if (!byBrewery.has(key)) {
      byBrewery.set(key, { breweryId: key, breweryName: p.breweryName ?? '', order: p.breweryDisplayOrder ?? 0, products: [] });
    }
    byBrewery.get(key)!.products.push(p);
  }
  const KIND_ORDER = [ProductKind.Keg, ProductKind.Bottle, ProductKind.Can, ProductKind.Multipack, ProductKind.Other];
  return Array.from(byBrewery.values())
    .sort((a, b) => a.order - b.order)
    .map((b) => {
      const byKind = new Map<ProductKind, IProductListItemDto[]>();
      for (const p of b.products) {
        const k = p.kind ?? ProductKind.Other;
        if (!byKind.has(k)) byKind.set(k, []);
        byKind.get(k)!.push(p);
      }
      const kinds = KIND_ORDER.filter((k) => byKind.has(k)).map((k) => {
        const bySize = new Map<number, IProductListItemDto[]>();
        for (const p of byKind.get(k)!) {
          const size = p.packageSize ?? -1;
          if (!bySize.has(size)) bySize.set(size, []);
          bySize.get(size)!.push(p);
        }
        const packageSizes = Array.from(bySize.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([size, prods]) => new PackageGroupDto({
            size: size === -1 ? undefined : size,
            items: prods.map((p) => new ProductListItemDto(p)),
          }));
        return new KindGroupDto({ kind: k, packageSizes });
      });
      return new BreweryGroupDto({ breweryId: b.breweryId, breweryName: b.breweryName, kinds });
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

  // ---- Clients ----------------------------------------------------------
  getClientListEndpoint(parameters: { [key: string]: string }) {
    const search = parameters?.['search'] ?? parameters?.['Search'];
    const rows = db.clients
      .filter((c) => matches(c.name, search) || matches(c.businessName, search))
      .map((c) => new ClientListItemDto({ id: c.id, name: c.name, region: c.region }));
    return mockDelay(rows);
  },
  getClientDetailEndpoint(id: string) {
    const c = db.clients.find((x) => x.id === id);
    if (!c) return Promise.reject(new MockNotFoundError('Klient'));
    return mockDelay(clientToDetailDto(c));
  },
  createClientEndpoint(data: CreateClientDto) {
    const id = mockId('cl');
    db.clients.push({
      id, name: data.name, businessName: data.businessName, region: data.region,
      officialAddress: fromAddressDto(data.officialAddress)!,
      contactAddress: fromAddressDto(data.contactAddress),
      contacts: (data.contacts ?? []).map(fromContactDto),
    });
    return mockDelay(id);
  },
  updateClientEndpoint(id: string, data: UpdateClientDto) {
    const c = db.clients.find((x) => x.id === id);
    if (!c) return Promise.reject(new MockNotFoundError('Klient'));
    c.name = data.name;
    c.businessName = data.businessName;
    c.region = data.region;
    if (data.officialAddress) c.officialAddress = fromAddressDto(data.officialAddress)!;
    c.contactAddress = fromAddressDto(data.contactAddress);
    c.contacts = (data.contacts ?? []).map(fromContactDto);
    return mockDelay(id);
  },
  deleteClientEndpoint(id: string) {
    const i = db.clients.findIndex((x) => x.id === id);
    if (i >= 0) db.clients.splice(i, 1);
    db.clientReminders = db.clientReminders.filter((r) => r.ownerId !== id);
    db.clientNotes = db.clientNotes.filter((n) => n.ownerId !== id);
    return mockDelay(id);
  },

  // ---- Client reminders ---------------------------------------------------
  getClientRemindersListEndpoint(id: string) {
    const rows = db.clientReminders.filter((r) => r.ownerId === id).map(reminderToDto);
    return mockDelay(rows);
  },
  createClientReminderEndpoint(id: string, data: CreateReminderDto) {
    const rid = mockId('crem');
    db.clientReminders.push({
      id: rid, ownerId: id, name: data.name, description: data.description, type: data.type,
      occurrenceDate: data.occurrenceDate, numberOfDaysToRemindBefore: data.numberOfDaysToRemindBefore,
      isResolved: false,
    });
    return mockDelay(rid);
  },
  updateClientReminderEndpoint(id: string, data: UpdateReminderDto) {
    const r = db.clientReminders.find((x) => x.id === id);
    if (!r) return Promise.reject(new MockNotFoundError('Připomínka'));
    Object.assign(r, {
      name: data.name, description: data.description, type: data.type, occurrenceDate: data.occurrenceDate,
      numberOfDaysToRemindBefore: data.numberOfDaysToRemindBefore,
      resolvedDate: data.resolvedDate, isResolved: data.resolvedDate != null,
    });
    return mockDelay(id);
  },
  setClientReminderResolvedDateEndpoint(id: string, req: SetClientReminderResolvedDateRequest) {
    const r = db.clientReminders.find((x) => x.id === id);
    if (!r) return Promise.reject(new MockNotFoundError('Připomínka'));
    r.resolvedDate = req.resolvedDate;
    r.isResolved = req.resolvedDate != null;
    return mockDelay(id);
  },
  deleteClientReminderEndpoint(id: string) {
    const i = db.clientReminders.findIndex((x) => x.id === id);
    if (i >= 0) db.clientReminders.splice(i, 1);
    return mockDelay(id);
  },

  // ---- Client notes (real endpoints — no demoNotes fallback needed) -------
  getClientNotesEndpoint(id: string) {
    const rows = db.clientNotes
      .filter((n) => n.ownerId === id)
      .sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime())
      .map((n) => new NoteDto({ id: n.id, text: n.text }));
    return mockDelay(rows);
  },
  createClientNoteEndpoint(id: string, data: CreateNoteDto) {
    const nid = mockId('cnote');
    db.clientNotes.unshift({ id: nid, ownerId: id, text: data.text, createdDate: new Date() });
    return mockDelay(nid);
  },
  deleteClientNoteEndpoint(id: string) {
    const i = db.clientNotes.findIndex((x) => x.id === id);
    if (i >= 0) db.clientNotes.splice(i, 1);
    return mockDelay(id);
  },

  // ---- Orders (Objednávky) ---------------------------------------------------
  getOrdersListEndpoint() {
    const rows = db.orders
      .slice()
      .sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime())
      .map(orderToListDto);
    return mockDelay(rows);
  },
  getOrderDetailEndpoint(id: string) {
    const o = db.orders.find((x) => x.id === id);
    if (!o) return Promise.reject(new MockNotFoundError('Objednávka'));
    return mockDelay(orderToDetailDto(o));
  },
  createOrderEndpoint(data: CreateOrderDto) {
    const id = mockId('ord');
    db.orders.unshift({
      id,
      clientId: data.clientId,
      // Mirrors the prototype's oeSave: a required delivery date already
      // moves a brand-new order out of "New" and into "Planning".
      state: data.requiredDeliveryDate ? OrderState.Planning : OrderState.New,
      createdDate: new Date(),
      requiredDeliveryDate: data.requiredDeliveryDate,
      items: toMockOrderItems(data.orderItems),
    });
    return mockDelay(id);
  },
  updateOrderEndpoint(id: string, data: UpdateOrderDto) {
    const o = db.orders.find((x) => x.id === id);
    if (!o) return Promise.reject(new MockNotFoundError('Objednávka'));
    o.clientId = data.clientId;
    o.requiredDeliveryDate = data.requiredDeliveryDate;
    o.actualDeliveryDate = data.actualDeliveryDate;
    o.items = toMockOrderItems(data.orderItems);
    if (data.state != null) o.state = data.state;
    else if (o.state === OrderState.New && data.requiredDeliveryDate) o.state = OrderState.Planning;
    return mockDelay(id);
  },
  deleteOrderEndpoint(id: string) {
    // Per the prototype's delOrder(): "delete" cancels the order rather than
    // erasing it, so it stays visible in the client's history.
    const o = db.orders.find((x) => x.id === id);
    if (o) o.state = OrderState.Cancelled;
    return mockDelay(id);
  },

  // ---- Order editor catalog (history-first product picker) ------------------
  getProductsByClientHistoryEndpoint(clientId: string) {
    const seen = new Set<string>();
    const recent: ProductListItemDto[] = [];
    db.orders
      .filter((o) => o.clientId === clientId)
      .sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime())
      .forEach((o) => o.items.forEach((it) => {
        if (seen.has(it.productId)) return;
        const p = db.products.find((x) => x.id === it.productId);
        if (p) { seen.add(it.productId); recent.push(new ProductListItemDto(p)); }
      }));
    const breweries = buildBreweryGroups(db.products);
    return mockDelay(new GroupedProductHistoryDto({ recent, breweries }));
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
