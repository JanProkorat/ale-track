// The write-side draft both the detail screen and the editor resend. Everything the server treats
// as "the full list" has to survive the round trip, or a save made for one reason silently deletes
// data that belongs to another.

import { describe, expect, it } from 'vitest';
import {
  OutgoingShipmentDetailDto,
  OutgoingShipmentPreparationStepDto,
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
