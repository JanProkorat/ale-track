import { describe, expect, it } from 'vitest';
import { DayOfWeek, SupplierOpeningHoursDto } from 'src/generated/api-client';
import { supplierStopHours } from './supplierStopHours';

/** 2026-08-24 is a Monday; the run leaves at 07:30 local time. */
const MONDAY_MORNING = new Date(2026, 7, 24, 7, 30);
/** Same Monday, late enough to be past everything below. */
const MONDAY_EVENING = new Date(2026, 7, 24, 19, 15);
/** 2026-08-26, a Wednesday. */
const WEDNESDAY = new Date(2026, 7, 26, 9, 0);

const hours = (dayOfWeek: DayOfWeek, from: string, to: string) =>
  new SupplierOpeningHoursDto({ dayOfWeek, from, to });

// The API serializes enums as strings, which is the shape dayIdx is written to survive; the
// numeric members here go through the same resolution.
const MONDAY_WEEK = [
  hours(DayOfWeek.Monday, '07:00:00', '15:30:00'),
  hours(DayOfWeek.Tuesday, '07:00:00', '15:30:00'),
];

describe('supplierStopHours', () => {
  it('reads out the day the run falls on', () => {
    expect(supplierStopHours(MONDAY_WEEK, MONDAY_MORNING)).toEqual({
      text: 'Po 7:00–15:30',
      closedAtArrival: false,
    });
  });

  // The one thing the dispatcher needs to see before the van sets off.
  it('flags a run timed outside the day\'s hours', () => {
    expect(supplierStopHours(MONDAY_WEEK, MONDAY_EVENING)).toEqual({
      text: 'Po 7:00–15:30',
      closedAtArrival: true,
    });
  });

  it('says the supplier is shut on a day it does not open', () => {
    expect(supplierStopHours(MONDAY_WEEK, WEDNESDAY)).toEqual({
      text: 'St zavřeno',
      closedAtArrival: true,
    });
  });

  // A lunch gap is two intervals on one day. Both are read out, and the gap itself counts as shut.
  it('reads out both halves of a split day', () => {
    const week = [
      hours(DayOfWeek.Monday, '07:00:00', '11:30:00'),
      hours(DayOfWeek.Monday, '12:00:00', '15:30:00'),
    ];

    expect(supplierStopHours(week, MONDAY_MORNING)).toEqual({
      text: 'Po 7:00–11:30 · 12:00–15:30',
      closedAtArrival: false,
    });
    expect(supplierStopHours(week, new Date(2026, 7, 24, 11, 45))).toEqual({
      text: 'Po 7:00–11:30 · 12:00–15:30',
      closedAtArrival: true,
    });
  });

  it('never calls a nonstop supplier shut', () => {
    const week = [hours(DayOfWeek.Monday, '00:00:00', '23:59:00')];

    expect(supplierStopHours(week, MONDAY_EVENING)).toEqual({
      text: 'Po nonstop',
      closedAtArrival: false,
    });
  });

  // Nothing to say rather than a half-truth: without a date there is no day to read out, and a
  // supplier with no schedule at all promises nothing.
  it('says nothing when the run has no date', () => {
    expect(supplierStopHours(MONDAY_WEEK, undefined)).toBeUndefined();
  });

  it('says nothing when the supplier has no hours recorded', () => {
    expect(supplierStopHours([], MONDAY_MORNING)).toBeUndefined();
    expect(supplierStopHours(undefined, MONDAY_MORNING)).toBeUndefined();
  });
});
