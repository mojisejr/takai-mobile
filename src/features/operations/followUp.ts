import { dayKey, formatThaiShortDate, localDateKey, nextDateFrom } from './date';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type FollowUpInputMode = 'date' | 'days';
export type FollowUpDueState = 'none' | 'upcoming' | 'due_today' | 'overdue';

type FollowUpResolutionInput = {
  mode: FollowUpInputMode;
  baseDate: string;
  directDate?: string | null;
  days?: string | number | null;
};

const validDateOnly = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const signedDayDifference = (from: string, to: string): number | null => {
  const left = Date.parse(`${dayKey(from)}T00:00:00.000Z`);
  const right = Date.parse(`${dayKey(to)}T00:00:00.000Z`);
  if (Number.isNaN(left) || Number.isNaN(right)) return null;
  return Math.round((left - right) / MS_PER_DAY);
};

/** Resolves either field entry mode to the only persisted follow-up fact: YYYY-MM-DD. */
export const resolveFollowUpOn = ({ baseDate, days, directDate, mode }: FollowUpResolutionInput): string | null => {
  if (!validDateOnly(dayKey(baseDate))) {
    throw new Error('กรุณาระบุวันที่ทำงานให้ถูกต้องก่อนตั้งวันติดตาม');
  }

  if (mode === 'date') {
    const value = directDate?.trim() ?? '';
    if (!value) return null;
    if (!validDateOnly(value)) throw new Error('กรุณาระบุวันติดตามเป็น YYYY-MM-DD');
    return value;
  }

  const raw = String(days ?? '').trim();
  if (!raw || raw === '0') return null;
  const offset = Number(raw);
  if (!Number.isInteger(offset) || offset < 1) throw new Error('จำนวนวันติดตามต้องเป็นจำนวนเต็มตั้งแต่ 1 วัน');
  return nextDateFrom(baseDate, offset);
};

export const followUpDaysRemaining = (followUpOn: string | null | undefined, now = localDateKey()): number | null =>
  followUpOn && validDateOnly(dayKey(followUpOn)) ? signedDayDifference(followUpOn, now) : null;

export const followUpDueState = (followUpOn: string | null | undefined, now = localDateKey()): FollowUpDueState => {
  const remaining = followUpDaysRemaining(followUpOn, now);
  if (remaining === null) return 'none';
  if (remaining < 0) return 'overdue';
  if (remaining === 0) return 'due_today';
  return 'upcoming';
};

export const formatFollowUpDueLabel = (followUpOn: string | null | undefined, now = localDateKey()): string | null => {
  const remaining = followUpDaysRemaining(followUpOn, now);
  if (remaining === null || !followUpOn) return null;
  if (remaining < 0) return `เกินกำหนด ${Math.abs(remaining)} วัน`;
  if (remaining === 0) return 'ติดตามวันนี้';
  return `ติดตาม ${formatThaiShortDate(followUpOn)} · อีก ${remaining} วัน`;
};
