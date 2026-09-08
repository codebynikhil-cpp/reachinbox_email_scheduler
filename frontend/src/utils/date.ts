/**
 * Format a date string into a human-readable local time string.
 * Example: "21 Aug 2026, 06:30 PM"
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Format a date string as relative time (e.g. "2 hours ago", "in 3 days")
 */
export function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';

  const now = Date.now();
  const diff = date.getTime() - now;
  const absDiff = Math.abs(diff);

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const future = diff > 0;
  const prefix = future ? 'in ' : '';
  const suffix = future ? '' : ' ago';

  if (seconds < 60) return `${prefix}${seconds}s${suffix}`;
  if (minutes < 60) return `${prefix}${minutes}m${suffix}`;
  if (hours < 24) return `${prefix}${hours}h${suffix}`;
  return `${prefix}${days}d${suffix}`;
}

/**
 * Format a datetime-local input value from a Date object.
 * Returns the local ISO string in "YYYY-MM-DDTHH:mm" format for <input type="datetime-local">
 */
export function toDatetimeLocalValue(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Convert a datetime-local input value to an ISO-8601 string (UTC).
 */
export function datetimeLocalToISO(value: string): string {
  return new Date(value).toISOString();
}
