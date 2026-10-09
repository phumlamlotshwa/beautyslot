export type HoursRow = { day_of_week: number; start_time: string; end_time: string };

export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const SHORT_DAYS: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

export const LONG_DAYS: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday',
};

function dayRanges(positions: number[]): string {
  const parts: string[] = [];
  let start = positions[0];
  let prev = positions[0];

  for (const pos of [...positions.slice(1), -1]) {
    if (pos === prev + 1) {
      prev = pos;
      continue;
    }
    const first = SHORT_DAYS[DAY_ORDER[start]];
    const last = SHORT_DAYS[DAY_ORDER[prev]];
    parts.push(start === prev ? first : `${first}–${last}`);
    start = pos;
    prev = pos;
  }

  return parts.join(', ');
}

export function summarizeHours(rows: HoursRow[]): string[] {
  const groups = new Map<string, number[]>();

  DAY_ORDER.forEach((day, pos) => {
    const row = rows.find((r) => r.day_of_week === day);
    if (!row) return;
    const key = `${row.start_time.slice(0, 5)}–${row.end_time.slice(0, 5)}`;
    groups.set(key, [...(groups.get(key) ?? []), pos]);
  });

  return [...groups.entries()].map(([times, positions]) => `${dayRanges(positions)} · ${times}`);
}