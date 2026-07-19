// In-memory dataset backing DEMO sessions ("Prohlédnout bez připojení").
// Demo CRUD reads/writes these arrays; changes live for the session only and
// reset on reload. Real (logged-in) sessions never touch this — they hit the
// live API. Each module appends its collection + seed here as it's built.

import {
  type IVehicleDto,
  type IUserListItemDto,
  type IModulePermissionDto,
  type IProductListItemDto,
  type IInventoryItemListItemDto,
  UserRoleType,
  ProductKind,
  ProductType,
  Country,
  Region,
  ContactType,
  ReminderType,
  ModuleType,
  PermissionLevel,
  OrderState,
  OrderItemReminderState,
} from 'src/generated/api-client';

// Plain user shape for the demo store — permissions kept as the interface type
// (the generated IUserListItemDto references the concrete class); the mock API
// wraps them in the generated classes on the way out.
export interface MockUser extends Omit<IUserListItemDto, 'permissions'> {
  permissions?: IModulePermissionDto[];
}

export interface MockDb {
  vehicles: IVehicleDto[];
  users: MockUser[];
  products: IProductListItemDto[];
  inventory: MockInventorySection[];
  drivers: MockDriver[];
  breweries: MockBrewery[];
  breweryReminders: MockReminder[];
  breweryNotes: MockNote[];
  clients: MockClient[];
  clientReminders: MockReminder[];
  clientNotes: MockNote[];
  orders: MockOrder[];
}

// Free-text note scoped to its parent (brewery/client) via `ownerId`.
export interface MockNote {
  id: string;
  ownerId: string;
  text: string;
  createdDate: Date;
}

// Plain address shape mirroring IAddressDto (kept local so the demo store holds
// plain objects; the mock API wraps it in the generated AddressDto on the way out).
export interface MockAddress {
  streetName: string;
  streetNumber: string;
  city: string;
  zip: string;
  country: Country;
  latitude?: number;
  longitude?: number;
}

export interface MockBrewery {
  id: string;
  name: string;
  color: string;
  displayOrder: number;
  officialAddress: MockAddress;
  contactAddress?: MockAddress;
}

// Plain contact shape mirroring IClientContactDto.
export interface MockClientContact {
  type: ContactType;
  description?: string;
  value: string;
}

export interface MockClient {
  id: string;
  name: string;
  businessName?: string;
  region: Region;
  officialAddress: MockAddress;
  contactAddress?: MockAddress;
  contacts: MockClientContact[];
}

// A line item on an order — carries only the ids the real OrderItemDto needs
// to be resolved (product name/brewery ordering come from the joined product
// on the way out, same denormalization pattern as inventory items).
export interface MockOrderItem {
  id: string;
  productId: string;
  quantity: number;
  reminderState?: OrderItemReminderState;
}

export interface MockOrder {
  id: string;
  clientId: string;
  state: OrderState;
  createdDate: Date;
  requiredDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  items: MockOrderItem[];
}

// Reminder store shared by breweries/clients; `ownerId` scopes it to its parent.
export interface MockReminder {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  type: ReminderType;
  occurrenceDate?: Date;
  numberOfDaysToRemindBefore: number;
  isResolved: boolean;
  resolvedDate?: Date;
}

// Note: the generated `IInventorySectionDto.items` is typed as the concrete
// `InventoryItemListItemDto` class (an NSwag quirk), which doesn't suit a
// plain-object demo store. This local shape mirrors it with plain data.
export interface MockInventorySection {
  id?: string;
  name?: string;
  items: IInventoryItemListItemDto[];
}

// Availability is a plain `{from, until}` range mirroring
// `IDriverAvailabilityListItemDto` — kept local (not the generated class) so
// the demo store can hold plain objects like the other collections.
export interface MockDriverAvailability {
  from: Date;
  until: Date;
}

export interface MockDriver {
  id?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  color?: string;
  availableDates: MockDriverAvailability[];
}

const VEHICLES_SEED: IVehicleDto[] = [
  { id: 'veh-0001', name: 'Mercedes Sprinter (3S1 4472)', maxWeight: 1500 },
  { id: 'veh-0002', name: 'VW Crafter (3S2 8810)', maxWeight: 1400 },
  { id: 'veh-0003', name: 'Iveco Daily (2AB 1290)', maxWeight: 3500 },
  { id: 'veh-0004', name: 'Ford Transit (5U9 6631)', maxWeight: 1100 },
];

const USERS_SEED: MockUser[] = [
  { id: 'usr-0001', firstName: undefined, lastName: undefined, userName: 'admin', userRoles: [UserRoleType.Admin], permissions: [] },
  {
    id: 'usr-0002', firstName: 'Jana', lastName: 'Nováková', userName: 'jana.novakova', userRoles: [UserRoleType.User],
    permissions: [
      { module: ModuleType.Orders, level: PermissionLevel.Edit },
      { module: ModuleType.Shipments, level: PermissionLevel.Edit },
      { module: ModuleType.Clients, level: PermissionLevel.Edit },
      { module: ModuleType.Breweries, level: PermissionLevel.View },
      { module: ModuleType.Drivers, level: PermissionLevel.View },
    ],
  },
  {
    id: 'usr-0003', firstName: 'Petr', lastName: 'Svoboda', userName: 'petr.svoboda', userRoles: [UserRoleType.User],
    permissions: [
      { module: ModuleType.Inventory, level: PermissionLevel.Edit },
      { module: ModuleType.Deliveries, level: PermissionLevel.Edit },
      { module: ModuleType.Breweries, level: PermissionLevel.View },
    ],
  },
  {
    id: 'usr-0004', firstName: 'Lucie', lastName: 'Dvořáková', userName: 'lucie.dvorakova', userRoles: [UserRoleType.User],
    permissions: [
      { module: ModuleType.Orders, level: PermissionLevel.View },
      { module: ModuleType.Clients, level: PermissionLevel.View },
    ],
  },
  { id: 'usr-0005', firstName: 'Tomáš', lastName: 'Procházka', userName: 'tomas.prochazka', userRoles: [UserRoleType.User], permissions: [] },
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

// Five drivers with a distinct color each and 1-3 intra-day availability
// slots spread across the week of 2026-07-20 to 2026-07-25 (hardcoded 2026
// dates around "today" — fine for demo seed data) so both the "nearest
// availability" tile and the weekly time-grid calendar show real data.
const DRIVERS_SEED: MockDriver[] = [
  {
    id: 'drv-0001',
    firstName: 'Petr',
    lastName: 'Král',
    phoneNumber: '+420 601 234 567',
    color: '#E8590C',
    availableDates: [
      { from: new Date(2026, 6, 20, 8, 0), until: new Date(2026, 6, 20, 16, 0) },
      { from: new Date(2026, 6, 23, 7, 30), until: new Date(2026, 6, 23, 15, 0) },
    ],
  },
  {
    id: 'drv-0002',
    firstName: 'Martin',
    lastName: 'Dvořák',
    phoneNumber: '+420 602 345 678',
    color: '#2F9E44',
    availableDates: [{ from: new Date(2026, 6, 21, 9, 0), until: new Date(2026, 6, 21, 18, 0) }],
  },
  {
    id: 'drv-0003',
    firstName: 'Jakub',
    lastName: 'Horák',
    phoneNumber: '+420 603 456 789',
    color: '#1971C2',
    availableDates: [
      { from: new Date(2026, 6, 20, 12, 0), until: new Date(2026, 6, 20, 19, 0) },
      { from: new Date(2026, 6, 22, 6, 30), until: new Date(2026, 6, 22, 14, 0) },
      { from: new Date(2026, 6, 25, 8, 0), until: new Date(2026, 6, 25, 17, 0) },
    ],
  },
  {
    id: 'drv-0004',
    firstName: 'Tomáš',
    lastName: 'Beneš',
    phoneNumber: '+420 604 567 890',
    color: '#9C36B5',
    availableDates: [],
  },
  {
    id: 'drv-0005',
    firstName: 'Marek',
    lastName: 'Novotný',
    phoneNumber: '+420 605 678 901',
    color: '#E03131',
    availableDates: [{ from: new Date(2026, 6, 24, 8, 0), until: new Date(2026, 6, 24, 12, 30) }],
  },
];

// Three breweries; ids match the `breweryId`s on PRODUCTS_SEED so the ceník
// (per-brewery products) joins correctly in demo mode.
const BREWERIES_SEED: MockBrewery[] = [
  {
    id: 'brw-0001', name: 'Pivovar Únětice', color: '#C7911F', displayOrder: 1,
    officialAddress: { streetName: 'Rýznerova', streetNumber: '19', city: 'Únětice', zip: '25262', country: Country.Czechia, latitude: 50.1417, longitude: 14.3389 },
  },
  {
    id: 'brw-0002', name: 'Pivovar Kácov', color: '#2F6F4E', displayOrder: 2,
    officialAddress: { streetName: 'Pod Nádražím', streetNumber: '2', city: 'Kácov', zip: '28509', country: Country.Czechia, latitude: 49.7789, longitude: 15.0294 },
    contactAddress: { streetName: 'Pod Nádražím', streetNumber: '2', city: 'Kácov', zip: '28509', country: Country.Czechia, latitude: 49.7789, longitude: 15.0294 },
  },
  {
    id: 'brw-0003', name: 'Pivovar Rohozec', color: '#8B3A3A', displayOrder: 3,
    officialAddress: { streetName: 'Malý Rohozec', streetNumber: '29', city: 'Turnov', zip: '51101', country: Country.Czechia, latitude: 50.5989, longitude: 15.1372 },
  },
];

const BREWERY_REMINDERS_SEED: MockReminder[] = [
  { id: 'rem-0001', ownerId: 'brw-0001', name: 'Objednat etikety', description: 'Doobjednat etikety na láhve 0,5 l.', type: ReminderType.OneTimeEvent, occurrenceDate: new Date(2026, 6, 28), numberOfDaysToRemindBefore: 3, isResolved: false },
  { id: 'rem-0002', ownerId: 'brw-0002', name: 'Roční revize sudů', type: ReminderType.OneTimeEvent, occurrenceDate: new Date(2026, 8, 15), numberOfDaysToRemindBefore: 7, isResolved: false },
];

const BREWERY_NOTES_SEED: MockNote[] = [
  { id: 'bnote-0001', ownerId: 'brw-0001', text: 'Preferují dodávky v úterý dopoledne.', createdDate: new Date(2026, 5, 12) },
  { id: 'bnote-0002', ownerId: 'brw-0003', text: 'Nová řada nealko piv od jara 2026.', createdDate: new Date(2026, 4, 28) },
];

// Seven clients across four regions around the Žitava/Görlitz/Chemnitz area
// (coordinates are real-ish so PointMap renders sensible pins). Mixes German
// venue names (billed in Germany, per Country.Germany) with a Czech contact
// person style; two carry a separate contact address, one has no contacts.
const CLIENTS_SEED: MockClient[] = [
  {
    id: 'cl-0001', name: 'Hospoda U Kohouta', businessName: 'Kohout Gastro s.r.o.', region: Region.ZittauCity,
    officialAddress: { streetName: 'Bahnhofstraße', streetNumber: '12', city: 'Žitava', zip: '02763', country: Country.Germany, latitude: 50.8971, longitude: 14.8058 },
    contacts: [
      { type: ContactType.Phone, description: 'Vedoucí provozu', value: '+49 3583 123456' },
      { type: ContactType.Email, value: 'kohout@gastro.de' },
    ],
  },
  {
    id: 'cl-0002', name: 'Gasthaus Zur Linde', businessName: 'Zur Linde GmbH', region: Region.ZittauCity,
    officialAddress: { streetName: 'Neustadtplatz', streetNumber: '5', city: 'Žitava', zip: '02763', country: Country.Germany, latitude: 50.8945, longitude: 14.8102 },
    contactAddress: { streetName: 'Postfach', streetNumber: '20', city: 'Žitava', zip: '02764', country: Country.Germany },
    contacts: [{ type: ContactType.Email, description: 'Objednávky', value: 'info@zurlinde.de' }],
  },
  {
    id: 'cl-0003', name: 'Bierstube Am Markt', region: Region.ZittauRegion,
    officialAddress: { streetName: 'Marktplatz', streetNumber: '3', city: 'Hirschfelde', zip: '02788', country: Country.Germany, latitude: 50.9515, longitude: 14.8735 },
    contacts: [{ type: ContactType.Phone, value: '+49 35843 22110' }],
  },
  {
    id: 'cl-0004', name: 'Hotel Görlitzer Hof', businessName: 'Görlitzer Hof Hotel GmbH', region: Region.Goerlitz,
    officialAddress: { streetName: 'Berliner Straße', streetNumber: '44', city: 'Zhořelec', zip: '02826', country: Country.Germany, latitude: 51.1520, longitude: 14.9877 },
    contacts: [
      { type: ContactType.Email, description: 'Recepce', value: 'rezervace@goerlitzerhof.de' },
      { type: ContactType.Phone, value: '+49 3581 405060' },
    ],
  },
  {
    id: 'cl-0005', name: 'Wirtshaus Altstadt', businessName: 'Altstadt Gastro e.K.', region: Region.Goerlitz,
    officialAddress: { streetName: 'Untermarkt', streetNumber: '18', city: 'Zhořelec', zip: '02826', country: Country.Germany, latitude: 51.1497, longitude: 14.9857 },
    contactAddress: { streetName: 'Untermarkt', streetNumber: '18', city: 'Zhořelec', zip: '02826', country: Country.Germany, latitude: 51.1497, longitude: 14.9857 },
    contacts: [],
  },
  {
    id: 'cl-0006', name: 'Sport Bar Chemnitz', businessName: 'Sport Bar s.r.o.', region: Region.Chemnitz,
    officialAddress: { streetName: 'Brückenstraße', streetNumber: '7', city: 'Chemnitz', zip: '09111', country: Country.Germany, latitude: 50.8322, longitude: 12.9214 },
    contacts: [{ type: ContactType.Phone, description: 'Objednávky', value: '+49 371 998877' }],
  },
  {
    id: 'cl-0007', name: 'Restaurace U Radnice', businessName: 'U Radnice Chemnitz GmbH', region: Region.Chemnitz,
    officialAddress: { streetName: 'Markt', streetNumber: '1', city: 'Chemnitz', zip: '09111', country: Country.Germany, latitude: 50.8300, longitude: 12.9180 },
    contacts: [{ type: ContactType.Email, value: 'info@uradnice-chemnitz.de' }],
  },
];

const CLIENT_REMINDERS_SEED: MockReminder[] = [
  { id: 'crem-0001', ownerId: 'cl-0001', name: 'Prodloužit smlouvu', description: 'Roční smlouva o dodávkách končí koncem srpna.', type: ReminderType.OneTimeEvent, occurrenceDate: new Date(2026, 7, 25), numberOfDaysToRemindBefore: 10, isResolved: false },
  { id: 'crem-0002', ownerId: 'cl-0004', name: 'Sezónní objednávka na podzim', type: ReminderType.OneTimeEvent, occurrenceDate: new Date(2026, 9, 1), numberOfDaysToRemindBefore: 14, isResolved: false },
  { id: 'crem-0003', ownerId: 'cl-0006', name: 'Ověřit fakturační údaje', type: ReminderType.OneTimeEvent, occurrenceDate: new Date(2026, 5, 30), numberOfDaysToRemindBefore: 3, isResolved: true, resolvedDate: new Date(2026, 5, 28) },
];

const CLIENT_NOTES_SEED: MockNote[] = [
  { id: 'cnote-0001', ownerId: 'cl-0001', text: 'Preferuje dodávky v pátek odpoledne.', createdDate: new Date(2026, 5, 3) },
  { id: 'cnote-0002', ownerId: 'cl-0004', text: 'Hotel pořádá svatby — špičková spotřeba o víkendech.', createdDate: new Date(2026, 4, 20) },
];

// Eight orders across six of the seven clients (cl-0007 is left with no
// history so the editor's "Dříve objednané" empty state is exercised),
// mixing every OrderState so the list's status filter and detail's status-flow
// bar both show something in every step.
const ORDERS_SEED: MockOrder[] = [
  {
    id: 'ord-0001', clientId: 'cl-0001', state: OrderState.Finished,
    createdDate: new Date(2026, 5, 10), requiredDeliveryDate: new Date(2026, 5, 15), actualDeliveryDate: new Date(2026, 5, 15),
    items: [
      { id: 'oi-0001', productId: 'prod-0001', quantity: 4 },
      { id: 'oi-0002', productId: 'prod-0003', quantity: 20 },
    ],
  },
  {
    id: 'ord-0002', clientId: 'cl-0001', state: OrderState.Delivering,
    createdDate: new Date(2026, 6, 12), requiredDeliveryDate: new Date(2026, 6, 20),
    items: [
      { id: 'oi-0003', productId: 'prod-0001', quantity: 6, reminderState: OrderItemReminderState.Added },
      { id: 'oi-0004', productId: 'prod-0002', quantity: 2 },
    ],
  },
  {
    id: 'ord-0003', clientId: 'cl-0002', state: OrderState.Planning,
    createdDate: new Date(2026, 6, 15), requiredDeliveryDate: new Date(2026, 6, 25),
    items: [{ id: 'oi-0005', productId: 'prod-0004', quantity: 5 }],
  },
  {
    id: 'ord-0004', clientId: 'cl-0003', state: OrderState.New,
    createdDate: new Date(2026, 6, 18),
    items: [
      { id: 'oi-0006', productId: 'prod-0008', quantity: 3 },
      { id: 'oi-0007', productId: 'prod-0009', quantity: 2 },
    ],
  },
  {
    id: 'ord-0005', clientId: 'cl-0004', state: OrderState.Finished,
    createdDate: new Date(2026, 4, 2), requiredDeliveryDate: new Date(2026, 4, 10), actualDeliveryDate: new Date(2026, 4, 9),
    items: [
      { id: 'oi-0008', productId: 'prod-0006', quantity: 10 },
      { id: 'oi-0009', productId: 'prod-0007', quantity: 5 },
    ],
  },
  {
    id: 'ord-0006', clientId: 'cl-0005', state: OrderState.Cancelled,
    createdDate: new Date(2026, 5, 20), requiredDeliveryDate: new Date(2026, 5, 28),
    items: [{ id: 'oi-0010', productId: 'prod-0010', quantity: 8 }],
  },
  {
    id: 'ord-0007', clientId: 'cl-0006', state: OrderState.New,
    createdDate: new Date(2026, 6, 17),
    items: [{ id: 'oi-0011', productId: 'prod-0005', quantity: 4 }],
  },
  {
    id: 'ord-0008', clientId: 'cl-0001', state: OrderState.New,
    createdDate: new Date(2026, 6, 19),
    items: [{ id: 'oi-0012', productId: 'prod-0002', quantity: 3 }],
  },
];

export const db: MockDb = {
  vehicles: structuredClone(VEHICLES_SEED),
  users: structuredClone(USERS_SEED),
  products: structuredClone(PRODUCTS_SEED),
  inventory: structuredClone(INVENTORY_SEED),
  drivers: structuredClone(DRIVERS_SEED),
  breweries: structuredClone(BREWERIES_SEED),
  breweryReminders: structuredClone(BREWERY_REMINDERS_SEED),
  breweryNotes: structuredClone(BREWERY_NOTES_SEED),
  clients: structuredClone(CLIENTS_SEED),
  clientReminders: structuredClone(CLIENT_REMINDERS_SEED),
  clientNotes: structuredClone(CLIENT_NOTES_SEED),
  orders: structuredClone(ORDERS_SEED),
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
