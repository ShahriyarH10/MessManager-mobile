/**
 * Formatting + date/month helpers — ported from js/core/helpers.js.
 *
 * fmt() reproduces the web app's `Number(n).toLocaleString("en-IN")` (Indian
 * digit grouping, up to 3 decimals, trailing zeros dropped) with a hand-rolled
 * implementation, because Hermes' Intl support for the en-IN locale is not
 * guaranteed.
 */

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/** pad2(0) -> "01" (matches web: takes a 0-based month index) */
export const pad2 = (n: number): string => String(n + 1).padStart(2, '0');

export const monthKey = (year: number, month: number): string => `${year}-${pad2(month)}`;

function groupIndian(intStr: string): string {
  if (intStr.length <= 3) return intStr;
  const last3 = intStr.slice(-3);
  const rest = intStr.slice(0, -3);
  return rest.replace(/\B(?=(\d\d)+(?!\d))/g, ',') + ',' + last3;
}

export function fmt(n: number): string {
  const num = Number(n) || 0;
  if (!isFinite(num)) return '0';
  const neg = num < 0;
  const abs = Math.abs(num);
  const rounded = Math.round(abs * 1000) / 1000;
  const [intPart, decPart] = String(rounded).split('.');
  return (neg ? '-' : '') + groupIndian(intPart) + (decPart ? '.' + decPart : '');
}

export const fmtTk = (n: number): string => '৳' + fmt(n);

export const initials = (name: string): string =>
  name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/** Today as "YYYY-MM-DD" in local time. */
export function todayStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function thisMonth(): { month: number; year: number } {
  const n = new Date();
  return { month: n.getMonth(), year: n.getFullYear() };
}

export function monthIndexFromKey(key: string): number {
  return Math.max(0, Number(String(key || '').slice(5, 7)) - 1);
}

export function yearFromKey(key: string): number {
  return Number(String(key || '').slice(0, 4)) || new Date().getFullYear();
}

export function monthLabelFromKey(key: string): string {
  const [y, mm] = String(key || '').split('-');
  const idx = Math.max(0, Number(mm || 1) - 1);
  return `${MONTHS[idx] || 'Month'} ${y || ''}`.trim();
}

export function previousMonth(month: number, year: number): { month: number; year: number; key: string } {
  month = Number(month);
  year = Number(year);
  if (month === 0) return { month: 11, year: year - 1, key: monthKey(year - 1, 11) };
  return { month: month - 1, year, key: monthKey(year, month - 1) };
}

export function nextMonth(month: number, year: number): { month: number; year: number; key: string } {
  month = Number(month);
  year = Number(year);
  if (month === 11) return { month: 0, year: year + 1, key: monthKey(year + 1, 0) };
  return { month: month + 1, year, key: monthKey(year, month + 1) };
}

export function previousMonthFromKey(key: string): { month: number; year: number; key: string } {
  return previousMonth(monthIndexFromKey(key), yearFromKey(key));
}
