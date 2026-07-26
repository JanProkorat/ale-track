// Enum → Czech display strings, matching the backend's string enums and the
// prototype's vocabulary. "Basa" is used for the Bottle kind per the domain.

import {
  ProductKind, ProductType, Country, Region, ContactType, OrderState, OrderItemReminderState,
  OutgoingShipmentState, OutgoingShipmentStopAddressKind, ProductDeliveryState,
} from 'src/generated/api-client';

export const L = {
  orderState: {
    New: 'Nová',
    Planning: 'Plánuje se',
    Delivering: 'Rozváží se',
    Finished: 'Dokončeno',
    Cancelled: 'Zrušeno',
  } as Record<string, string>,
  shipState: {
    Created: 'Vytvořeno',
    Loaded: 'Naloženo',
    InTransit: 'Na cestě',
    Delivered: 'Doručeno',
    Cancelled: 'Zrušeno',
  } as Record<string, string>,
  deliveryState: {
    InPlanning: 'Plánuje se',
    OnTheWay: 'Na cestě',
    Finished: 'Dokončeno',
    Cancelled: 'Zrušeno',
  } as Record<string, string>,
  kind: {
    Keg: 'Sud',
    Bottle: 'Basa',
    Can: 'Plechovka',
    Multipack: 'Multipack',
    Other: 'Ostatní',
  } as Record<string, string>,
  ptype: {
    PaleDraftBeer: 'Světlé výčepní',
    PaleLager: 'Světlý ležák',
    AmberLager: 'Polotmavý ležák',
    DarkLager: 'Tmavý ležák',
    SpecialBeer: 'Speciál',
    NonAlcoholicBeer: 'Nealko',
    Radler: 'Radler',
    WheatBeer: 'Pšeničné',
    FlavoredBeer: 'Ochucené',
    Lemonade: 'Limonáda',
    YeastLager: 'Kroužkovaný ležák',
    Merchandise: 'Merch',
    Other: 'Ostatní',
  } as Record<string, string>,
  region: {
    ZittauCity: 'Žitava — město',
    ZittauRegion: 'Žitavsko',
    Chemnitz: 'Chemnitz',
    Leipzig: 'Lipsko',
    Berlin: 'Berlín',
    Freiberg: 'Freiberg',
    Goerlitz: 'Zhořelec',
    Region: 'Region',
    Other: 'Ostatní',
  } as Record<string, string>,
  contact: { Email: 'E-mail', Phone: 'Telefon' } as Record<string, string>,
  country: { Czechia: 'Česko', Germany: 'Německo' } as Record<string, string>,
  addrKind: { Official: 'Fakturační', Contact: 'Kontaktní', DeliveryPlace: 'Vlastní místo' } as Record<string, string>,
} as const;

// The generated enums are numeric, but the backend serializes enum values as
// strings on the wire (real mode) while demo seeds use the numeric enum. These
// helpers resolve either representation to the enum's name, then to Czech —
// so labels render correctly in BOTH modes.
function enumName(enumObj: Record<string, string | number>, val: unknown): string | undefined {
  if (val == null || val === '') return undefined;
  if (typeof val === 'number') return enumObj[val] as string | undefined; // numeric → name (demo)
  return String(val); // already the wire string name (real)
}

export function kindLabel(k?: ProductKind | string | number): string | undefined {
  const name = enumName(ProductKind as unknown as Record<string, string | number>, k);
  return name ? (L.kind[name] ?? name) : undefined;
}

export function ptypeLabel(t?: ProductType | string | number): string | undefined {
  const name = enumName(ProductType as unknown as Record<string, string | number>, t);
  return name ? (L.ptype[name] ?? name) : undefined;
}

export function countryLabel(c?: Country | string | number): string | undefined {
  const name = enumName(Country as unknown as Record<string, string | number>, c);
  return name ? (L.country[name] ?? name) : undefined;
}

/** The Region enum's member name (e.g. "ZittauCity"), resolved from either the
 * numeric (demo) or string (real) wire representation — used as the grouping
 * key so it can also index `L.region` for display. */
export function regionName(r?: Region | string | number): string | undefined {
  return enumName(Region as unknown as Record<string, string | number>, r);
}

export function regionLabel(r?: Region | string | number): string | undefined {
  const name = regionName(r);
  return name ? (L.region[name] ?? name) : undefined;
}

/** Resolves either wire representation of ContactType to its Czech label
 * ("E-mail"/"Telefon"), and a matching `isEmailContact` check for icon choice. */
export function contactTypeLabel(t?: ContactType | string | number): string | undefined {
  const name = enumName(ContactType as unknown as Record<string, string | number>, t);
  return name ? (L.contact[name] ?? name) : undefined;
}

export function isEmailContact(t?: ContactType | string | number): boolean {
  return enumName(ContactType as unknown as Record<string, string | number>, t) === 'Email';
}

/** The OrderState enum's member name (e.g. "Planning"), resolved from either
 * the numeric (demo) or string (real) wire representation — used to index
 * both `L.orderState` and `ORDER_STATUS` below. */
export function orderStateName(s?: OrderState | string | number): string | undefined {
  return enumName(OrderState as unknown as Record<string, string | number>, s);
}

/** Whether an order item's reminder ("hlídáno" badge) is in the Added state,
 * resolved from either wire representation. */
export function isReminderAdded(s?: OrderItemReminderState | string | number): boolean {
  return enumName(OrderItemReminderState as unknown as Record<string, string | number>, s) === 'Added';
}

export type ReminderName = 'None' | 'Added' | 'Resolved';

/** The order-item reminder state's member name, resolved from either wire form
 * ("None" when unset). */
export function reminderStateName(s?: OrderItemReminderState | string | number): ReminderName {
  if (s == null) return 'None';
  const name = enumName(OrderItemReminderState as unknown as Record<string, string | number>, s);
  return name === 'Resolved' ? 'Resolved' : name === 'Added' ? 'Added' : 'None';
}

/** Normalize an order-item reminder state to the numeric enum (or undefined for
 * "not watched") for write DTOs. */
export function reminderStateValue(s?: OrderItemReminderState | string | number): OrderItemReminderState | undefined {
  const n = reminderStateName(s);
  return n === 'Added' ? OrderItemReminderState.Added : n === 'Resolved' ? OrderItemReminderState.Resolved : undefined;
}

/** The OutgoingShipmentState enum's member name (e.g. "InTransit"), resolved
 * from either wire representation — indexes both `L.shipState` and
 * `SHIP_STATUS`. */
export function shipStateName(s?: OutgoingShipmentState | string | number): string | undefined {
  return enumName(OutgoingShipmentState as unknown as Record<string, string | number>, s);
}

/** The ProductDeliveryState enum's member name (e.g. "OnTheWay"), resolved
 * from either wire representation — indexes `DELIVERY_STATUS`. */
export function deliveryStateName(s?: ProductDeliveryState | string | number): string | undefined {
  return enumName(ProductDeliveryState as unknown as Record<string, string | number>, s);
}

/** The stop's chosen address kind ("Official"/"Contact"), resolved from
 * either wire representation, and its Czech label via `L.addrKind`. */
export function addrKindName(k?: OutgoingShipmentStopAddressKind | string | number): string | undefined {
  return enumName(OutgoingShipmentStopAddressKind as unknown as Record<string, string | number>, k);
}

/** Normalize an address kind (which the API sends as a string) to the numeric
 * enum value the MUI Select / write DTOs expect. Must round-trip all three
 * members — a stop loaded with `DeliveryPlace` falling through to `Official`
 * here would silently relocate the delivery the moment the shipment is
 * re-saved, even without the user touching the picker. */
export function addrKindValue(k?: OutgoingShipmentStopAddressKind | string | number): OutgoingShipmentStopAddressKind {
  const name = addrKindName(k);
  if (name === 'Contact') return OutgoingShipmentStopAddressKind.Contact;
  if (name === 'DeliveryPlace') return OutgoingShipmentStopAddressKind.DeliveryPlace;
  return OutgoingShipmentStopAddressKind.Official;
}

export function addrKindLabel(k?: OutgoingShipmentStopAddressKind | string | number): string | undefined {
  const name = addrKindName(k);
  return name ? (L.addrKind[name] ?? name) : undefined;
}

export const KIND_ORDER: Record<string, number> = {
  Keg: 1,
  Bottle: 2,
  Can: 3,
  Multipack: 4,
  Other: 5,
};

export type StatusTone = 'grey' | 'amber' | 'ok' | 'info' | 'crit';

type StatusMap = Record<string, { tone: StatusTone; label: string }>;

export const ORDER_STATUS: StatusMap = {
  New: { tone: 'grey', label: 'Nová' },
  Planning: { tone: 'info', label: 'Plánuje se' },
  Delivering: { tone: 'amber', label: 'Rozváží se' },
  Finished: { tone: 'ok', label: 'Dokončeno' },
  Cancelled: { tone: 'grey', label: 'Zrušeno' },
};

export const SHIP_STATUS: StatusMap = {
  Created: { tone: 'grey', label: 'Vytvořeno' },
  Loaded: { tone: 'info', label: 'Naloženo' },
  InTransit: { tone: 'amber', label: 'Na cestě' },
  Delivered: { tone: 'ok', label: 'Doručeno' },
  Cancelled: { tone: 'grey', label: 'Zrušeno' },
};

export const DELIVERY_STATUS: StatusMap = {
  InPlanning: { tone: 'info', label: 'Plánuje se' },
  OnTheWay: { tone: 'amber', label: 'Na cestě' },
  Finished: { tone: 'ok', label: 'Dokončeno' },
  Cancelled: { tone: 'grey', label: 'Zrušeno' },
};
