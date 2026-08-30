// What a run must have before it may advance, and how to say so.
//
// A mirror of the API's ShipmentStateTransition.EnsureReady, which refuses the move otherwise. The
// rule was only ever enforced there, so the header offered "Vyrazit" on a run with nobody driving
// it and the office found out from the error toast. Keep the two in step: a change to EnsureReady
// or to OutgoingShipment.HasFilledData belongs here too.
//
// Two different bars, deliberately:
//
//   Naloženo  — a vehicle and stops. Nakládka is pieces going into one particular van, checked off
//               against its capacity, and the state freezes what it was loaded with. None of that
//               means anything without knowing the van. The driver and the date are not needed to
//               load a van in the yard.
//   Na cestě / Doručeno — everything: driver, vehicle, date, stops.

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

/** What the target state asks for. */
function prereqsFor(to: OutgoingShipmentState): DeparturePrereq[] {
  if (to === OutgoingShipmentState.Loaded) return ['vehicle', 'stops'];
  return ['driver', 'vehicle', 'date', 'stops'];
}

/** Whether a prerequisite is missing from the run. */
function isMissing(shipment: OutgoingShipmentDetailDto, prereq: DeparturePrereq): boolean {
  switch (prereq) {
    case 'driver':
      // Either shape counts: the detail DTO carries both the ids and the drivers themselves.
      return (shipment.driverIds?.length ?? 0) === 0 && (shipment.drivers?.length ?? 0) === 0;
    case 'vehicle':
      return !shipment.vehicleId;
    case 'date':
      return !shipment.deliveryDate;
    default:
      return (shipment.stops?.length ?? 0) === 0;
  }
}

/**
 * What the run is missing for a given step, in reading order — driver first, it is the one the
 * office forgets.
 */
export function missingForState(
  shipment: OutgoingShipmentDetailDto,
  to: OutgoingShipmentState,
): DeparturePrereq[] {
  return prereqsFor(to).filter((prereq) => isMissing(shipment, prereq));
}

/** Whether the API's readiness check stands between the run and this state. */
export function needsDeparturePrep(to: OutgoingShipmentState): boolean {
  return to === OutgoingShipmentState.Loaded
    || to === OutgoingShipmentState.InTransit
    || to === OutgoingShipmentState.Delivered;
}

/** The tooltip on the disabled lifecycle button. */
export function departureBlockReason(to: OutgoingShipmentState, missing: DeparturePrereq[]): string {
  const step = to === OutgoingShipmentState.Loaded
    ? 'Vývoz nelze naložit'
    : to === OutgoingShipmentState.Delivered
      ? 'Vývoz nelze doručit'
      : 'Vývoz nemůže vyrazit';

  return `${step}: chybí ${missing.map((m) => PREREQ_LABEL[m]).join(', ')}.`;
}
