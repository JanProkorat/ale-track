// What a supplier pickup's row says about opening hours: the day the run falls on, and whether
// the van would arrive to a closed gate.
//
// The reasoning itself is Dodavatelé's (features/suppliers/supplierHours.ts) — this only asks it
// about one particular moment, the run's own date and time, rather than about "now". Kept apart
// from that file because the question is the shipment's: a supplier list wants "open right now",
// a run wants "open when we get there".

import { type SupplierOpeningHoursDto } from 'src/generated/api-client';
import {
  WEEKDAYS_SHORT, hoursOfDay, hoursText, isNonstop, minutesOf, minutesNow, weekdayIdx,
} from 'src/features/suppliers/supplierHours';

export interface StopHoursNote {
  /** "Po 7:00–15:30", "Po 7:00–11:30 · 12:00–15:30", "St zavřeno". */
  text: string;
  /** True when the run's own time falls in none of the day's intervals. */
  closedAtArrival: boolean;
}

/**
 * The hours line for a supplier stop, or nothing when there is nothing to say.
 *
 * Nothing means one of two things, and neither is worth a line: the run has no date yet, so there
 * is no day to read out; or the supplier has no schedule recorded at all, which promises nothing.
 * A supplier that is simply shut on the run's day is a different matter — that is the line worth
 * having.
 *
 * The run carries one date and time (its "Datum a čas"), not a per-stop arrival, so this is that
 * moment held against the supplier's day — which is what the office is checking before the van
 * sets off.
 */
export function supplierStopHours(
  hours: SupplierOpeningHoursDto[] | undefined,
  deliveryDate: Date | undefined,
): StopHoursNote | undefined {
  if (!deliveryDate || !hours?.length) return undefined;

  const day = weekdayIdx(deliveryDate);
  const dayHours = hoursOfDay(hours, day);
  const at = minutesNow(deliveryDate);

  const open = isNonstop(dayHours)
    || dayHours.some((h) => minutesOf(h.from) <= at && at < minutesOf(h.to));

  return {
    text: `${WEEKDAYS_SHORT[day]} ${hoursText(dayHours)}`,
    closedAtArrival: !open,
  };
}
