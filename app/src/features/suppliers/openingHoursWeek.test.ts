// The week's rules, tested on the pure validator rather than through the drawer: this is
// what decides whether a save is attempted at all, and it mirrors the server's own check.
import { describe, it, expect } from 'vitest';
import { validateWeek } from './openingHoursWeek';

const row = (day: string, from: string, to: string) => ({ day, from, to });

describe('validateWeek', () => {
  it('accepts an empty week — a supplier may simply have no hours recorded', () => {
    expect(validateWeek([])).toBeNull();
  });

  it('accepts a lunch break as two intervals in one day', () => {
    expect(validateWeek([
      row('Monday', '07:00', '11:30'),
      row('Monday', '12:00', '15:30'),
    ])).toBeNull();
  });

  it('accepts intervals that touch without overlapping', () => {
    expect(validateWeek([
      row('Monday', '07:00', '11:30'),
      row('Monday', '11:30', '15:30'),
    ])).toBeNull();
  });

  it('rejects intervals that overlap in one day', () => {
    expect(validateWeek([
      row('Monday', '07:00', '12:00'),
      row('Monday', '11:30', '15:30'),
    ])).toMatch(/překrývat/);
  });

  it('does not treat the same times on different days as an overlap', () => {
    expect(validateWeek([
      row('Monday', '07:00', '15:30'),
      row('Tuesday', '07:00', '15:30'),
    ])).toBeNull();
  });

  it('rejects an interval that ends before it starts', () => {
    expect(validateWeek([row('Friday', '15:00', '07:00')])).toMatch(/později/);
  });

  it('rejects a zero-length interval', () => {
    expect(validateWeek([row('Friday', '07:00', '07:00')])).toMatch(/později/);
  });

  it('rejects a half-filled row rather than sending it', () => {
    expect(validateWeek([row('Friday', '07:00', '')])).toMatch(/Vyplňte/);
  });

  it('accepts the whole-day interval that means nonstop', () => {
    expect(validateWeek([row('Sunday', '00:00', '23:59')])).toBeNull();
  });

  it('finds an overlap regardless of the order the rows arrive in', () => {
    expect(validateWeek([
      row('Wednesday', '12:00', '18:00'),
      row('Wednesday', '07:00', '13:00'),
    ])).toMatch(/překrývat/);
  });
});
