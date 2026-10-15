import { Customer, Occasion, OCCASION_TYPES } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Date of the occasion in a given year. Feb 29 falls back to Feb 28 in non-leap years. */
export function occurrenceInYear(o: Pick<Occasion, 'day' | 'month'>, year: number): Date {
  const day = o.month === 2 && o.day === 29 && !isLeapYear(year) ? 28 : o.day;
  return new Date(year, o.month - 1, day);
}

/** Next occurrence on or after `from` (today counts). */
export function nextOccurrence(o: Pick<Occasion, 'day' | 'month'>, from = new Date()): Date {
  const today = startOfDay(from);
  const thisYear = occurrenceInYear(o, today.getFullYear());
  return thisYear >= today ? thisYear : occurrenceInYear(o, today.getFullYear() + 1);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

export function formatDayMonth(day: number, month: number): string {
  return `${day} ${MONTHS[month - 1]}`;
}

export function formatDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatWeekday(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

export function relativeDays(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function occasionTitle(o: Occasion): string {
  if (o.type === 'other') return o.label?.trim() || 'Occasion';
  return OCCASION_TYPES.find((t) => t.value === o.type)!.label;
}

export function occasionEmoji(o: Occasion): string {
  return OCCASION_TYPES.find((t) => t.value === o.type)!.emoji;
}

/** e.g. "Turns 30" / "10th anniversary", when the original year is known. */
export function milestoneText(o: Occasion, occurrence: Date): string | undefined {
  if (!o.year) return undefined;
  const n = occurrence.getFullYear() - o.year;
  if (n <= 0) return undefined;
  if (o.type === 'birthday') return `Turns ${n}`;
  if (o.type === 'anniversary') return `${ordinal(n)} anniversary`;
  return `${ordinal(n)} year`;
}

export interface UpcomingItem {
  customer: Customer;
  occasion: Occasion;
  date: Date;
  daysAway: number;
  reminded: boolean;
}

export function isReminded(c: Customer, occasionId: string, year: number): boolean {
  return c.contactLog.some((l) => l.occasionId === occasionId && l.year === year);
}

/** Every occasion whose next occurrence falls within `windowDays` from today, soonest first. */
export function getUpcoming(customers: Customer[], windowDays: number, from = new Date()): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  for (const customer of customers) {
    for (const occasion of customer.occasions) {
      const date = nextOccurrence(occasion, from);
      const daysAway = daysBetween(from, date);
      if (daysAway <= windowDays) {
        items.push({
          customer,
          occasion,
          date,
          daysAway,
          reminded: isReminded(customer, occasion.id, date.getFullYear()),
        });
      }
    }
  }
  return items.sort((a, b) => a.daysAway - b.daysAway || a.customer.name.localeCompare(b.customer.name));
}
