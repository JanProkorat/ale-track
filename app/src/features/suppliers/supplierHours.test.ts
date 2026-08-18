// Ports the prototype's opening-hours assertions to the real wire format. The cases are
// the ones that decide a route: the lunch gap, the roll to the next open day, the Sunday
// skip, a nonstop point just before midnight, and a supplier with no hours at all.

import { describe, it, expect } from 'vitest';
import { DayOfWeek, SupplierOpeningHoursDto } from 'src/generated/api-client';
import {
  dayIdx, hm, hoursOfDay, hoursText, isNonstop, minutesOf, openBadgeText, openState,
  openStateText, weekdayIdx,
} from './supplierHours';

/** Wire-shaped interval: TimeOnly serialises with seconds, so the fixtures do too. */
const h = (day: DayOfWeek, from: string, to: string) =>
  new SupplierOpeningHoursDto({ dayOfWeek: day, from: `${from}:00`, to: `${to}:00` });

/** Linde: lunch break Mon–Thu, short Friday, Saturday morning, closed Sunday. */
const LINDE = [
  h(DayOfWeek.Monday, '07:00', '11:30'), h(DayOfWeek.Monday, '12:00', '15:30'),
  h(DayOfWeek.Tuesday, '07:00', '11:30'), h(DayOfWeek.Tuesday, '12:00', '15:30'),
  h(DayOfWeek.Friday, '07:00', '13:00'),
  h(DayOfWeek.Saturday, '08:00', '11:00'),
];

/** A self-service výdejní box: the whole week in one interval per day. */
const AUTOMAT = [
  h(DayOfWeek.Monday, '00:00', '23:59'), h(DayOfWeek.Tuesday, '00:00', '23:59'),
  h(DayOfWeek.Wednesday, '00:00', '23:59'), h(DayOfWeek.Thursday, '00:00', '23:59'),
  h(DayOfWeek.Friday, '00:00', '23:59'), h(DayOfWeek.Saturday, '00:00', '23:59'),
  h(DayOfWeek.Sunday, '00:00', '23:59'),
];

// 2026-08-17 is a Monday; offsets walk the week from there.
const at = (dayOffset: number, time: string) => new Date(`2026-08-${17 + dayOffset}T${time}:00`);

describe('weekday mapping', () => {
  it('is Monday-first for a Date', () => {
    expect(weekdayIdx(at(0, '10:00'))).toBe(0);
    expect(weekdayIdx(at(5, '10:00'))).toBe(5);
    expect(weekdayIdx(at(6, '10:00'))).toBe(6);
  });

  it('converts the wire enum, which counts Sunday as zero', () => {
    expect(dayIdx(DayOfWeek.Monday)).toBe(0);
    expect(dayIdx(DayOfWeek.Saturday)).toBe(5);
    expect(dayIdx(DayOfWeek.Sunday)).toBe(6);
  });
});

describe('time parsing and formatting', () => {
  it('reads TimeOnly strings as minutes since midnight', () => {
    expect(minutesOf('07:00:00')).toBe(420);
    expect(minutesOf('23:59:00')).toBe(1439);
    expect(minutesOf(undefined)).toBe(0);
  });

  it('formats without seconds or a leading zero', () => {
    expect(hm('07:00:00')).toBe('7:00');
    expect(hm('11:30:00')).toBe('11:30');
    expect(hm('00:00:00')).toBe('0:00');
  });
});

describe('openState — the lunch gap is the whole point', () => {
  it('is open inside the morning interval', () => {
    const s = openState(LINDE, at(0, '09:00'));
    expect(s.open).toBe(true);
    expect(hm(s.until)).toBe('11:30');
    expect(openStateText(s)).toBe('otevřeno do 11:30');
  });

  it('is closed during the lunch gap and reopens the same day', () => {
    const s = openState(LINDE, at(0, '11:45'));
    expect(s.open).toBe(false);
    expect(s.nextDay).toBeNull();
    expect(openStateText(s)).toBe('otevře v 12:00');
  });

  it('is open again after the break', () => {
    expect(openState(LINDE, at(0, '12:30')).open).toBe(true);
  });

  it('closes exactly at the end of an interval', () => {
    expect(openState(LINDE, at(0, '15:30')).open).toBe(false);
    expect(openState(LINDE, at(0, '15:29')).open).toBe(true);
  });

  it('opens exactly at the start of an interval', () => {
    expect(openState(LINDE, at(0, '07:00')).open).toBe(true);
    expect(openState(LINDE, at(0, '06:59')).open).toBe(false);
  });

  it('rolls past a closed weekday to the next open one', () => {
    // Tuesday evening: Wednesday and Thursday have no hours, so Friday is next.
    const s = openState(LINDE, at(1, '18:00'));
    expect(s.open).toBe(false);
    expect(s.nextDay).toBe(4);
    expect(openStateText(s)).toBe('otevře Pá 7:00');
  });

  it('skips Sunday and wraps to Monday', () => {
    const s = openState(LINDE, at(6, '10:00'));
    expect(s.open).toBe(false);
    expect(s.nextDay).toBe(0);
    expect(openStateText(s)).toBe('otevře Po 7:00');
  });

  it('wraps from Saturday afternoon to Monday, not to the same Saturday', () => {
    const s = openState(LINDE, at(5, '12:00'));
    expect(s.nextDay).toBe(0);
    expect(hm(s.next ?? undefined)).toBe('7:00');
  });

  it('treats a supplier with no hours as permanently closed', () => {
    const s = openState([], at(0, '09:00'));
    expect(s.open).toBe(false);
    expect(s.next).toBeNull();
    expect(openStateText(s)).toBe('bez otevírací doby');
  });

  it('treats undefined hours the same way, without throwing', () => {
    expect(openState(undefined, at(0, '09:00')).open).toBe(false);
  });
});

describe('nonstop point', () => {
  it('is open at every hour, including just before midnight', () => {
    for (const time of ['00:01', '03:30', '13:00', '23:58']) {
      const s = openState(AUTOMAT, at(0, time));
      expect(s.open, time).toBe(true);
      expect(s.nonstop, time).toBe(true);
    }
  });

  it('renders as "nonstop" rather than as a range', () => {
    expect(hoursText(hoursOfDay(AUTOMAT, 0))).toBe('nonstop');
    expect(openStateText(openState(AUTOMAT, at(0, '13:00')))).toBe('nonstop');
    expect(openBadgeText(openState(AUTOMAT, at(0, '13:00')))).toBe('nonstop');
  });

  it('is recognised from the stored 00:00–23:59 pair', () => {
    expect(isNonstop(hoursOfDay(AUTOMAT, 3))).toBe(true);
    expect(isNonstop(hoursOfDay(LINDE, 0))).toBe(false);
  });
});

describe('hoursText', () => {
  it('joins the intervals of a day with a separator', () => {
    expect(hoursText(hoursOfDay(LINDE, 0))).toBe('7:00–11:30 · 12:00–15:30');
  });

  it('says zavřeno for a day with no interval', () => {
    expect(hoursText(hoursOfDay(LINDE, 6))).toBe('zavřeno');
  });

  it('sorts a day\'s intervals even when the server order is reversed', () => {
    const reversed = [h(DayOfWeek.Monday, '12:00', '15:30'), h(DayOfWeek.Monday, '07:00', '11:30')];
    expect(hoursText(hoursOfDay(reversed, 0))).toBe('7:00–11:30 · 12:00–15:30');
  });

  it('keeps days apart — same clock times on two weekdays are not one day', () => {
    expect(hoursOfDay(LINDE, 0)).toHaveLength(2);
    expect(hoursOfDay(LINDE, 1)).toHaveLength(2);
    expect(hoursOfDay(LINDE, 4)).toHaveLength(1);
  });
});

describe('badge text', () => {
  it('reads zavřeno when closed and otevřeno when open', () => {
    expect(openBadgeText(openState(LINDE, at(0, '11:45')))).toBe('zavřeno');
    expect(openBadgeText(openState(LINDE, at(0, '09:00')))).toBe('otevřeno');
  });
});
