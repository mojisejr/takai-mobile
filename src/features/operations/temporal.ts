import type { ActivityTemporalInput, ActivityTimeMode } from './types';

export type NormalizedActivityTemporal = {
  performedAt: string;
  activityDate: string | null;
  timeMode: ActivityTimeMode | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
};

const dateOnly = (value: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('TAKAI activity date must be YYYY-MM-DD');
  return value;
};

const localDateTime = (value: string, date: string, label: string): string => {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error(`TAKAI ${label} must be HH:mm`);
  return `${date}T${value}:00`;
};

export const normalizeActivityTemporal = (input: Pick<ActivityTemporalInput, 'timeMode' | 'activityDate' | 'startedAt' | 'endedAt' | 'durationMinutes'> & { performedAt: string }): NormalizedActivityTemporal => {
  if (!input.timeMode) return { performedAt: input.performedAt, activityDate: null, timeMode: null, startedAt: null, endedAt: null, durationMinutes: null };
  const activityDate = dateOnly(input.activityDate ?? '');
  if (input.timeMode === 'all_day') {
    return { performedAt: `${activityDate}T12:00:00.000Z`, activityDate, timeMode: 'all_day', startedAt: null, endedAt: null, durationMinutes: null };
  }
  if (input.timeMode === 'duration_only') {
    const durationMinutes = Number(input.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) throw new Error('TAKAI duration must be a positive number of minutes');
    return { performedAt: `${activityDate}T12:00:00.000Z`, activityDate, timeMode: 'duration_only', startedAt: null, endedAt: null, durationMinutes };
  }
  const startedAt = localDateTime(input.startedAt ?? '', activityDate, 'start time');
  const endedAt = localDateTime(input.endedAt ?? '', activityDate, 'end time');
  if (endedAt <= startedAt) throw new Error('TAKAI end time must be after start time');
  return { performedAt: startedAt, activityDate, timeMode: 'time_range', startedAt, endedAt, durationMinutes: null };
};
