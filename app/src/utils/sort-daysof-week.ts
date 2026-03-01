import type { DayOfWeek } from 'src/api/Client';

export function sortDaysOfWeek(days: DayOfWeek[]): DayOfWeek[] {
     return [...days].sort((a, b) => {
          const orderA = (a + 6) % 7;
          const orderB = (b + 6) % 7;
          return orderA - orderB;
     });
}
