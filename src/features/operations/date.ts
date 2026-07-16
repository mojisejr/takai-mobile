const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEMO_NOW = '2026-07-16T08:30:00.000Z';

export const dayKey = (value: string): string => value.slice(0, 10);

export const diffDays = (from: string, to = DEMO_NOW): number => {
  const left = Date.parse(`${dayKey(from)}T00:00:00.000Z`);
  const right = Date.parse(`${dayKey(to)}T00:00:00.000Z`);
  if (Number.isNaN(left) || Number.isNaN(right)) {
    return 0;
  }
  return Math.max(0, Math.round((right - left) / MS_PER_DAY));
};

export const formatThaiShortDate = (value: string | null | undefined): string => {
  if (!value) return '-';
  const date = new Date(`${dayKey(value)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return dayKey(value);
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }).replace('.', '');
};

export const nextDateFrom = (value: string, days: number): string => {
  const date = new Date(`${dayKey(value)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
