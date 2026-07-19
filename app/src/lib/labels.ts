// Enum → Czech display strings, matching the backend's string enums and the
// prototype's vocabulary. "Basa" is used for the Bottle kind per the domain.

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
  addrKind: { Official: 'Fakturační', Contact: 'Kontaktní' } as Record<string, string>,
} as const;

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
