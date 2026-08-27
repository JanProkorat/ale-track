// What a run must have before it may leave, and how to say so.
//
// A mirror of OutgoingShipment.HasFilledData on the API side, which is what
// ShipmentStateTransition.EnsureReady refuses InTransit and Delivered without. The rule was only
// ever enforced there, so the header offered "Vyrazit" on a run with nobody driving it and the
// office found out from the error toast. Keep the two in step: a change to HasFilledData belongs
// here too.

import {
  OutgoingShipmentState,
  type OutgoingShipmentDetailDto,
} from 'src/generated/api-client';

export type DeparturePrereq = 'driver' | 'vehicle' | 'date' | 'stops';

const PREREQ_LABEL: Record<DeparturePrereq, string> = {
  driver: 'řidič',
  vehicle: 'vozidlo',
  date: 'termín',
  stops: 'zastávky',
};

/** In reading order, driver first — it is the one the office forgets. */
export function missingForDeparture(shipment: OutgoingShipmentDetailDto): DeparturePrereq[] {
  const missing: DeparturePrereq[] = [];

  // Either shape counts: the detail DTO carries both the ids and the drivers themselves.
  if ((shipment.driverIds?.length ?? 0) === 0 && (shipment.drivers?.length ?? 0) === 0) {
    missing.push('driver');
  }
  if (!shipment.vehicleId) missing.push('vehicle');
  if (!shipment.deliveryDate) missing.push('date');
  if ((shipment.stops?.length ?? 0) === 0) missing.push('stops');

  return missing;
}

/** Whether the API's readiness check stands between the run and this state. */
export function needsDeparturePrep(to: OutgoingShipmentState): boolean {
  return to === OutgoingShipmentState.InTransit || to === OutgoingShipmentState.Delivered;
}

/** The tooltip on the disabled lifecycle button. */
export function departureBlockReason(to: OutgoingShipmentState, missing: DeparturePrereq[]): string {
  const step = to === OutgoingShipmentState.Delivered ? 'Vývoz nelze doručit' : 'Vývoz nemůže vyrazit';
  return `${step}: chybí ${missing.map((m) => PREREQ_LABEL[m]).join(', ')}.`;
}
