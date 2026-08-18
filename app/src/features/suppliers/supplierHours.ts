// Opening-hours reasoning for Dodavatelé: is this supplier open right now, and if not,
// when does it open? Pure and clock-injectable, so it is unit-tested rather than
// eyeballed — the lunch-gap and next-day cases are exactly where a wrong answer sends a
// van on a wasted trip.
//
// Ported from the approved prototype (`docs/prototype/aletrack-prototype.html`) with two
// changes forced by the real wire format:
//
//   1. Times arrive as `TimeOnly` strings ("07:00:00"), not "HH:MM", so everything
//      compares in minutes-since-midnight rather than lexically. That also removes the
//      prototype's dependence on both operands being the same width.
//   2. A nonstop point is 00:00–23:59, not the prototype's 00:00–24:00: neither
//      `TimeOnly` nor an <input type="time"> can express 24:00. "Nonstop" is therefore
//      how that pair is rendered, and `isNonstop` is what decides it.

import { DayOfWeek, type SupplierOpeningHoursDto } from 'src/generated/api-client';

/** Monday-first weekday labels — the order Czech schedules are read in. */
export const WEEKDAYS_SHORT = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'] as const;
export const WEEKDAYS_LONG = [
  'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle',
] as const;

/** The seven `DayOfWeek` values in Monday-first order, for rendering a week. */
export const WEEK_ORDER: DayOfWeek[] = [
  DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday,
  DayOfWeek.Friday, DayOfWeek.Saturday, DayOfWeek.Sunday,
];

/** Monday-first index (0–6) of a `Date`. `getDay()` counts from Sunday. */
export function weekdayIdx(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Monday-first index of a wire `DayOfWeek`, which counts Sunday as 0. */
export function dayIdx(day: DayOfWeek | number | undefined): number {
  return ((Number(day ?? 0) + 6) % 7);
}

/** Minutes since midnight for a `TimeOnly` string ("07:00:00", "7:00", "23:59"). */
export function minutesOf(time: string | undefined): number {
  if (!time) return 0;
  const [h, m] = time.split(':');
  return Number(h) * 60 + Number(m ?? 0);
}

/** Minutes since midnight of a `Date`, in local time — the viewer's own clock. */
export function minutesNow(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** "07:00:00" → "7:00". Drops seconds and a leading zero, keeping 24-hour form. */
export function hm(time: string | undefined): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  return `${Number(h)}:${(m ?? '00').padStart(2, '0')}`;
}

/** A supplier's intervals for one Monday-first weekday index, earliest first. */
export function hoursOfDay(
  hours: SupplierOpeningHoursDto[] | undefined,
  mondayFirstDay: number,
): SupplierOpeningHoursDto[] {
  return (hours ?? [])
    .filter((h) => dayIdx(h.dayOfWeek) === mondayFirstDay)
    .sort((a, b) => minutesOf(a.from) - minutesOf(b.from));
}

/** Whether a day's intervals cover the whole day — one interval from 00:00 to 23:59. */
export function isNonstop(dayHours: SupplierOpeningHoursDto[]): boolean {
  if (dayHours.length !== 1) return false;
  return minutesOf(dayHours[0].from) === 0 && minutesOf(dayHours[0].to) >= 23 * 60 + 59;
}

/** "7:00–11:30 · 12:00–15:30", "nonstop", or "zavřeno". */
export function hoursText(dayHours: SupplierOpeningHoursDto[]): string {
  if (dayHours.length === 0) return 'zavřeno';
  if (isNonstop(dayHours)) return 'nonstop';
  return dayHours.map((h) => `${hm(h.from)}–${hm(h.to)}`).join(' · ');
}

export interface OpenState {
  open: boolean;
  /** When the current interval ends — only set while open. */
  until?: string;
  /** True when the whole day is one interval. */
  nonstop: boolean;
  /** When the supplier next opens; null when it has no hours at all. */
  next: string | null | undefined;
  /** Monday-first index of the day `next` falls on; null when it is later today. */
  nextDay: number | null;
}

/**
 * Open or closed at `now`, and what happens next.
 *
 * `nextDay` is null when the next opening is later the same day, so a caller can say
 * "otevře v 12:00" rather than naming today's weekday back to the reader. `next` is null
 * only when the supplier has no recorded hours, which reads as permanently closed rather
 * than as unknown — a registry row with no schedule cannot promise anything.
 */
export function openState(hours: SupplierOpeningHoursDto[] | undefined, now: Date): OpenState {
  const today = weekdayIdx(now);
  const t = minutesNow(now);
  const todays = hoursOfDay(hours, today);

  const current = todays.find((h) => minutesOf(h.from) <= t && t < minutesOf(h.to));
  if (current) {
    return { open: true, until: current.to, nonstop: isNonstop(todays), next: null, nextDay: null };
  }

  const later = todays.find((h) => minutesOf(h.from) > t);
  if (later) {
    return { open: false, nonstop: false, next: later.from, nextDay: null };
  }

  // Wrap around the week. Starting at +1 means a supplier closed for the rest of today
  // still reports next week's same weekday rather than claiming it opens today.
  for (let i = 1; i <= 7; i += 1) {
    const day = (today + i) % 7;
    const dayHours = hoursOfDay(hours, day);
    if (dayHours.length > 0) {
      return { open: false, nonstop: false, next: dayHours[0].from, nextDay: day };
    }
  }

  return { open: false, nonstop: false, next: null, nextDay: null };
}

/** The sentence a dispatcher reads: can a van go there now, and if not, when? */
export function openStateText(state: OpenState): string {
  if (state.open) return state.nonstop ? 'nonstop' : `otevřeno do ${hm(state.until)}`;
  if (!state.next) return 'bez otevírací doby';
  return state.nextDay == null
    ? `otevře v ${hm(state.next)}`
    : `otevře ${WEEKDAYS_SHORT[state.nextDay]} ${hm(state.next)}`;
}

/** Short badge text beside the pill in a list row. */
export function openBadgeText(state: OpenState): string {
  if (!state.open) return 'zavřeno';
  return state.nonstop ? 'nonstop' : 'otevřeno';
}
