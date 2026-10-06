import { SeverityLevel } from '@/core/hazard/SeverityLevel';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} mins ago`;
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(diff / DAY);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function timeUntil(date: Date, now: Date = new Date()): string {
  const diff = date.getTime() - now.getTime();
  if (diff <= 0) return 'expired';
  if (diff < HOUR) return `${Math.ceil(diff / MINUTE)} mins`;
  if (diff < DAY) return `${Math.round(diff / HOUR)}h`;
  const days = Math.round(diff / DAY);
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString('en-LK', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Wireframes call the top level "Critical"; the domain keeps the original EMERGENCY name. */
export const SEVERITY_LABELS: Readonly<Record<SeverityLevel, string>> = {
  [SeverityLevel.ADVISORY]: 'Advisory',
  [SeverityLevel.WARNING]: 'Warning',
  [SeverityLevel.EMERGENCY]: 'Critical',
};
