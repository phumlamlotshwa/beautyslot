export type BusyTime = {
  starts_at: string;
  ends_at: string;
};

const MINUTE = 60 * 1000;

export function getOpenSlots(
  date: Date,
  openTime: string,
  closeTime: string,
  durationMinutes: number,
  busy: BusyTime[],
  stepMinutes = 30
): Date[] {
  const [openHour, openMinute] = openTime.split(':').map(Number);
  const [closeHour, closeMinute] = closeTime.split(':').map(Number);

  const dayOpen = new Date(date.getFullYear(), date.getMonth(), date.getDate(), openHour, openMinute);
  const dayClose = new Date(date.getFullYear(), date.getMonth(), date.getDate(), closeHour, closeMinute);
  const now = Date.now();

  const busyRanges = busy.map((b) => ({
    start: new Date(b.starts_at).getTime(),
    end: new Date(b.ends_at).getTime(),
  }));

  const slots: Date[] = [];

  for (
    let start = dayOpen.getTime();
    start + durationMinutes * MINUTE <= dayClose.getTime();
    start += stepMinutes * MINUTE
  ) {
    const end = start + durationMinutes * MINUTE;

    if (start <= now) continue;

    const clashes = busyRanges.some((b) => start < b.end && end > b.start);

    if (!clashes) {
      slots.push(new Date(start));
    }
  }

  return slots;
}