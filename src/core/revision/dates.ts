import { addDays, format, isValid, parseISO } from 'date-fns';

export function todayKey(date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

export function parseDateKey(value: string): Date {
  const date = parseISO(value);
  if (!isValid(date)) throw new Error(`Invalid calendar date: ${value}`);
  return date;
}

export function addCalendarDays(dateKey: string, amount: number): string {
  return format(addDays(parseDateKey(dateKey), amount), 'yyyy-MM-dd');
}

export function formatDate(dateKey: string, pattern = 'MMM d, yyyy'): string {
  if (!dateKey) return 'Not scheduled';
  return format(parseDateKey(dateKey), pattern);
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  try {
    return format(parseDateKey(value), 'yyyy-MM-dd') === value;
  } catch {
    return false;
  }
}
