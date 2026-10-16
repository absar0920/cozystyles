/** Store-time-zone date helpers (client-safe). Every "today / last N days" boundary in the admin uses these. */
export const STORE_TIME_ZONE = 'Asia/Karachi';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Offset (ms) of the store time zone from UTC at `d` (Asia/Karachi has no DST, but compute it anyway). */
function zoneOffsetMs(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** 00:00 store time today, as a UTC Date. */
export function startOfStoreDay(now: Date = new Date()): Date {
  const offset = zoneOffsetMs(now);
  const local = now.getTime() + offset;
  const midnightLocal = local - (((local % DAY_MS) + DAY_MS) % DAY_MS);
  return new Date(midnightLocal - offset);
}

/** startOfStoreDay(now) minus (days - 1) days: the start of a "last N days" range that includes today. */
export function storeRangeStart(days: number, now: Date = new Date()): Date {
  return new Date(startOfStoreDay(now).getTime() - Math.max(0, days - 1) * DAY_MS);
}

/** "15 Oct 2026, 3:42 pm" in store time. */
export function formatStoreDateTime(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: STORE_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toLowerCase()}`;
}

/** "just now", "5 min ago", "2 h ago", "3 days ago", then the date. */
export function timeAgo(d: Date, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return days === 1 ? '1 day ago' : `${days} days ago`;
  return formatStoreDateTime(d).split(',')[0];
}
