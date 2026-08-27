import { describe, expect, it } from 'vitest';
import {
  OutgoingShipmentDetailDto,
  OutgoingShipmentState,
  OutgoingShipmentStopDto,
  ShipmentDriverDto,
} from 'src/generated/api-client';
import { departureBlockReason, missingForDeparture } from './departureReadiness';

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

describe('missingForDeparture', () => {
  it('asks for nothing of a run that is ready to leave', () => {
    expect(missingForDeparture(ready())).toEqual([]);
  });

  it('reports a run with nobody driving it', () => {
    expect(missingForDeparture(ready({ driverIds: [], drivers: [] }))).toEqual(['driver']);
  });

  // Both shapes travel on the detail DTO; either one carrying a driver is a driver assigned.
  it('takes the driver list as the answer when the ids are missing', () => {
    expect(missingForDeparture(ready({ driverIds: undefined }))).toEqual([]);
  });

  it('reports a missing van, date and stops one at a time', () => {
    expect(missingForDeparture(ready({ vehicleId: undefined }))).toEqual(['vehicle']);
    expect(missingForDeparture(ready({ deliveryDate: undefined }))).toEqual(['date']);
    expect(missingForDeparture(ready({ stops: [] }))).toEqual(['stops']);
  });

  // The order is the tooltip's reading order, and the driver is what the office forgets.
  it('names the driver first when several things are missing', () => {
    const missing = missingForDeparture(new OutgoingShipmentDetailDto({ id: 'ship-1' }));

    expect(missing).toEqual(['driver', 'vehicle', 'date', 'stops']);
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
});
