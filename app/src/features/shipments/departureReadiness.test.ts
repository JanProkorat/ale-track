import { describe, expect, it } from 'vitest';
import {
  OutgoingShipmentDetailDto,
  OutgoingShipmentState,
  OutgoingShipmentStopDto,
  ShipmentDriverDto,
} from 'src/generated/api-client';
import {
  departureBlockReason, missingForState, needsDeparturePrep,
} from './departureReadiness';

const DEPART = OutgoingShipmentState.InTransit;

/** A run the API would let leave: date, van, driver, one stop. */
function ready(over: Partial<OutgoingShipmentDetailDto> = {}) {
  return new OutgoingShipmentDetailDto({
    id: 'ship-1',
    deliveryDate: new Date('2026-08-27T00:00:00Z'),
    vehicleId: 'van-1',
    driverIds: ['driver-1'],
    drivers: [new ShipmentDriverDto({ id: 'driver-1', firstName: 'Jan', lastName: 'Řidič' })],
    stops: [new OutgoingShipmentStopDto({ id: 'stop-1', order: 1 })],
    ...over,
  });
}

describe('missingForState — leaving', () => {
  it('asks for nothing of a run that is ready to leave', () => {
    expect(missingForState(ready(), DEPART)).toEqual([]);
  });

  it('reports a run with nobody driving it', () => {
    expect(missingForState(ready({ driverIds: [], drivers: [] }), DEPART)).toEqual(['driver']);
  });

  // Both shapes travel on the detail DTO; either one carrying a driver is a driver assigned.
  it('takes the driver list as the answer when the ids are missing', () => {
    expect(missingForState(ready({ driverIds: undefined }), DEPART)).toEqual([]);
  });

  it('reports a missing van, date and stops one at a time', () => {
    expect(missingForState(ready({ vehicleId: undefined }), DEPART)).toEqual(['vehicle']);
    expect(missingForState(ready({ deliveryDate: undefined }), DEPART)).toEqual(['date']);
    expect(missingForState(ready({ stops: [] }), DEPART)).toEqual(['stops']);
  });

  // The order is the tooltip's reading order, and the driver is what the office forgets.
  it('names the driver first when several things are missing', () => {
    const missing = missingForState(new OutgoingShipmentDetailDto({ id: 'ship-1' }), DEPART);

    expect(missing).toEqual(['driver', 'vehicle', 'date', 'stops']);
  });
});

// Reported: a run went to Naloženo with no van assigned. Nakládka is pieces going into one
// particular van — checked off against its capacity, and frozen as what it was loaded with.
describe('missingForState — loading', () => {
  const LOAD = OutgoingShipmentState.Loaded;

  it('refuses to load a run with no van', () => {
    expect(missingForState(ready({ vehicleId: undefined }), LOAD)).toEqual(['vehicle']);
  });

  it('refuses to load a run with no stops', () => {
    expect(missingForState(ready({ stops: [] }), LOAD)).toEqual(['stops']);
  });

  // Loading a van in the yard needs neither of those. Only leaving does.
  it('asks for no driver and no date', () => {
    const bare = ready({ driverIds: [], drivers: [], deliveryDate: undefined });

    expect(missingForState(bare, LOAD)).toEqual([]);
  });

  it('stands between the run and Naloženo at all', () => {
    expect(needsDeparturePrep(LOAD)).toBe(true);
  });
});

describe('departureBlockReason', () => {
  it('names what is missing, in Czech, for the departure', () => {
    expect(departureBlockReason(OutgoingShipmentState.InTransit, ['driver', 'vehicle']))
      .toBe('Vývoz nemůže vyrazit: chybí řidič, vozidlo.');
  });

  it('speaks of delivery when that is the step being blocked', () => {
    expect(departureBlockReason(OutgoingShipmentState.Delivered, ['driver']))
      .toBe('Vývoz nelze doručit: chybí řidič.');
  });

  it('speaks of loading when that is the step being blocked', () => {
    expect(departureBlockReason(OutgoingShipmentState.Loaded, ['vehicle']))
      .toBe('Vývoz nelze naložit: chybí vozidlo.');
  });
});
