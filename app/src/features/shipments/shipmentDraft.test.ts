// The write-side draft both the detail screen and the editor resend. Everything the server treats
// as "the full list" has to survive the round trip, or a save made for one reason silently deletes
// data that belongs to another.

import { describe, expect, it } from 'vitest';
import {
  OutgoingShipmentDetailDto,
  OutgoingShipmentPreparationStepDto,
  OutgoingShipmentStopDto,
  OutgoingShipmentStopKind,
  ShipmentStartPointKind,
} from 'src/generated/api-client';
import { draftFromShipment } from './shipmentDraft';

function shipmentWithSteps(steps: OutgoingShipmentPreparationStepDto[]): OutgoingShipmentDetailDto {
  return new OutgoingShipmentDetailDto({ id: 'ship-1', name: 'Rozvoz', stops: [], preparationSteps: steps });
}

describe('draftFromShipment — preparation steps', () => {
  it('round-trips the checklist by ID', () => {
    // The server reads an omitted step as a deleted one, so a nakládka toggle or a state advance
    // would wipe the whole checklist if these did not ride along.
    const draft = draftFromShipment(shipmentWithSteps([
      new OutgoingShipmentPreparationStepDto({ id: 'step-1', order: 1, label: 'Naložit vratky', isDone: true }),
      new OutgoingShipmentPreparationStepDto({ id: 'step-2', order: 2, label: 'Umýt vůz', isDone: false }),
    ]));

    expect(draft.preparationSteps.map((s) => [s.id, s.order, s.label])).toEqual([
      ['step-1', 1, 'Naložit vratky'],
      ['step-2', 2, 'Umýt vůz'],
    ]);
  });

  it('sends no done flag — ticks belong to the set-step endpoint', () => {
    const draft = draftFromShipment(shipmentWithSteps([
      new OutgoingShipmentPreparationStepDto({ id: 'step-1', order: 1, label: 'Naložit vratky', isDone: true }),
    ]));

    expect(draft.preparationSteps[0]).not.toHaveProperty('isDone');
  });

  it('copes with a shipment that has no checklist', () => {
    const draft = draftFromShipment(new OutgoingShipmentDetailDto({ id: 'ship-1', name: 'Rozvoz', stops: [] }));

    expect(draft.preparationSteps).toEqual([]);
  });
});

// The API serializes enums as their names while the generated TS enum is numeric, so
// every fixture below uses the wire string a real response would carry — asserting
// against the numeric member instead would test a shape the server never sends.
describe('draftFromShipment — the Company stop', () => {
  it('keeps a Company stop a Company stop', () => {
    // An omitted `kind` means Custom to the server: the stored Company stop gets
    // demoted in place, the reconciler then appends a fresh one (a duplicate per
    // save), and the content freeze reads the demotion as a route change and
    // rejects the state advance.
    const draft = draftFromShipment(new OutgoingShipmentDetailDto({
      id: 'ship-1',
      name: 'Rozvoz',
      stops: [
        new OutgoingShipmentStopDto({
          id: 'hq',
          order: 1,
          kind: 'Company' as unknown as OutgoingShipmentStopKind,
          label: 'AleTrack s.r.o.',
          latitude: 50.7663,
          longitude: 15.0543,
        }),
        new OutgoingShipmentStopDto({
          id: 'fuel',
          order: 2,
          kind: 'Custom' as unknown as OutgoingShipmentStopKind,
          label: 'Pumpa u dálnice',
          latitude: 49.5,
          longitude: 15.5,
        }),
      ],
    }));

    expect(draft.customStops.map((s) => [s.id, s.kind])).toEqual([
      ['hq', 'Company'],
      ['fuel', 'Custom'],
    ]);
  });
});

describe('draftFromShipment — the start point', () => {
  it('round-trips a brewery start point', () => {
    // Without these, the write DTO's defaults apply (Company / no brewery), so any
    // detail-screen save — a nakládka tick, a state advance — quietly moves the run's
    // origin back to the depot.
    const draft = draftFromShipment(new OutgoingShipmentDetailDto({
      id: 'ship-1',
      name: 'Rozvoz',
      stops: [],
      startPointKind: 'Brewery' as unknown as ShipmentStartPointKind,
      startBreweryId: 'brewery-svijany',
    }));

    expect(draft.startPointKind).toBe('Brewery');
    expect(draft.startBreweryId).toBe('brewery-svijany');
  });

  it('defaults to the company when the shipment records no start point', () => {
    const draft = draftFromShipment(new OutgoingShipmentDetailDto({ id: 'ship-1', name: 'Rozvoz', stops: [] }));

    expect(draft.startPointKind).toBe(ShipmentStartPointKind.Company);
    expect(draft.startBreweryId).toBeUndefined();
  });
});
