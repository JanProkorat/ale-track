// What to tell the user while a shipment transition is in flight.
//
// A transition is not a field write: loading takes pieces off the shelf and freezes the
// prices each client will be billed, setting out puts every order on the run into
// "rozváží se", delivering books the run's stock purchases in and closes the orders, and
// reverting or cancelling undoes the stock movement. All of that happens server-side in one
// request, so the button can be busy for a noticeable moment — and a bare spinner leaves the
// user guessing whether anything is happening at all.
//
// Kept out of ShipmentDetail so the wording is testable without a rendering harness.

import { shipStateName } from 'src/lib/labels';
import type { OutgoingShipmentState } from 'src/generated/api-client';

export interface StateChangeProgress {
  /** What is happening, as a headline. */
  title: string;
  /** The consequences worth naming, so a slow transition reads as work rather than a hang. */
  detail: string;
}

const BY_STATE: Record<string, StateChangeProgress> = {
  Loaded: {
    title: 'Nakládám vývoz…',
    detail: 'Odepisuji kusy ze skladu, zamykám obsah nakládky a fixuji ceny pro klienty.',
  },
  InTransit: {
    title: 'Vypravuji vývoz…',
    detail: 'Přepínám objednávky na rozvozu na stav „rozváží se“.',
  },
  Delivered: {
    title: 'Uzavírám vývoz…',
    detail: 'Naskladňuji zboží na sklad a uzavírám objednávky jako doručené.',
  },
  Created: {
    title: 'Vracím vývoz k plánování…',
    detail: 'Vracím odebrané kusy zpět na sklad a odemykám obsah nakládky.',
  },
  Cancelled: {
    title: 'Ruším vývoz…',
    detail: 'Vracím odebrané kusy na sklad a uvolňuji objednávky pro další plánování.',
  },
};

const FALLBACK: StateChangeProgress = {
  title: 'Měním stav vývozu…',
  detail: 'Promítám změnu do objednávek a skladu.',
};

/**
 * What is happening while the shipment moves to `state`.
 *
 * Falls back to a generic message rather than rendering nothing: an unrecognised state means
 * the enum grew, and a silent overlay would be worse than an unspecific one.
 */
export function stateChangeProgress(state: OutgoingShipmentState): StateChangeProgress {
  return BY_STATE[shipStateName(state) ?? ''] ?? FALLBACK;
}
