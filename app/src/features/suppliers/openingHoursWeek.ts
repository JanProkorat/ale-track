// The week editor's own rules, split out of OpeningHoursDrawer so the component file
// exports only a component (react-refresh) and the rules stay testable without rendering.

/** One editor row. Times are "HH:MM", as an <input type="time"> gives them. */
export interface WeekRow {
  /** DayOfWeek member name — the wire form, and what the Combobox holds. */
  day: string;
  from: string;
  to: string;
}

function minutes(value: string): number {
  const [h, m] = value.split(':');
  return Number(h) * 60 + Number(m ?? 0);
}

/**
 * Client-side mirror of the server's interval rules, so a mistake is caught in the form
 * rather than coming back as a 400 attached to nothing the user can see. Returns a Czech
 * message, or null when the week is fine.
 *
 * The overlap rule is per weekday: the same clock times on Monday and Tuesday are not an
 * overlap, which is why this groups before comparing.
 */
export function validateWeek(rows: WeekRow[]): string | null {
  for (const r of rows) {
    if (!r.from || !r.to) return 'Vyplňte začátek i konec každého intervalu.';
    if (minutes(r.from) >= minutes(r.to)) return 'Interval musí končit později, než začíná.';
  }

  const byDay = new Map<string, WeekRow[]>();
  for (const r of rows) {
    byDay.set(r.day, [...(byDay.get(r.day) ?? []), r]);
  }

  for (const dayRows of byDay.values()) {
    const ordered = [...dayRows].sort((a, b) => minutes(a.from) - minutes(b.from));
    for (let i = 1; i < ordered.length; i += 1) {
      if (minutes(ordered[i].from) < minutes(ordered[i - 1].to)) {
        return 'Intervaly ve stejném dni se nesmí překrývat.';
      }
    }
  }

  return null;
}
