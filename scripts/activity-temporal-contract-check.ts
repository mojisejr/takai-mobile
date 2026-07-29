import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { SqlExecutor } from '../src/data';
import { createActivity, normalizeActivityTemporal } from '../src/features/operations';

class TemporalDb implements SqlExecutor {
  writes: Array<{ sql: string; params: unknown[] }> = [];
  async execAsync(): Promise<void> {}
  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql.includes('FROM activity_categories WHERE id = ?')) return [{ id: params[0] }] as T[];
    if (sql.includes('FROM people WHERE id = ?')) return [{ id: params[0] }] as T[];
    if (sql.includes('FROM crop_cycles') && sql.includes('starts_on <= date')) return [];
    if (sql.includes('SELECT id, display_name')) return [
      { id: 'worker-a', display_name: 'สมชาย', role: 'worker', is_self: 0, specialty: '', phone: '', note: '', archived_at: null },
      { id: 'worker-b', display_name: 'สมหญิง', role: 'worker', is_self: 0, specialty: '', phone: '', note: '', archived_at: null },
    ] as T[];
    throw new Error(`Unhandled temporal SQL read: ${sql}`);
  }
  async runAsync(sql: string, params: unknown[] = []): Promise<void> { this.writes.push({ sql, params }); }
}

const main = async (): Promise<void> => {
  const allDay = normalizeActivityTemporal({ performedAt: '2026-07-28T09:00:00.000Z', timeMode: 'all_day', activityDate: '2026-07-28' });
  assert.deepEqual(allDay, { performedAt: '2026-07-28T12:00:00.000Z', activityDate: '2026-07-28', timeMode: 'all_day', startedAt: null, endedAt: null, durationMinutes: null }, 'all-day stores a date fact without fabricated work start/end time');
  const range = normalizeActivityTemporal({ performedAt: 'legacy', timeMode: 'time_range', activityDate: '2026-07-28', startedAt: '08:30', endedAt: '10:15' });
  assert.equal(range.startedAt, '2026-07-28T08:30:00');
  assert.equal(range.endedAt, '2026-07-28T10:15:00');
  const duration = normalizeActivityTemporal({ performedAt: 'legacy', timeMode: 'duration_only', activityDate: '2026-07-28', durationMinutes: 90 });
  assert.equal(duration.durationMinutes, 90);
  assert.equal(normalizeActivityTemporal({ performedAt: '2026-07-28T23:30:00.000Z' }).activityDate, null, 'legacy performed_at remains readable as a historical fallback');
  assert.throws(() => normalizeActivityTemporal({ performedAt: 'legacy', timeMode: 'time_range', activityDate: '2026-07-28', startedAt: '10:00', endedAt: '09:00' }), /after start/);

  const db = new TemporalDb();
  await createActivity(db, {
    id: 'activity-time-workers', plotId: 'plot-a', categoryId: 'cat-note', performedAt: 'legacy',
    timeMode: 'duration_only', activityDate: '2026-07-28', durationMinutes: 90,
    note: 'ตัดแต่งกิ่ง', targetType: 'plot', targetId: 'plot-a', materials: [],
    participants: [
      { personId: 'worker-a', payType: 'hourly', amountDue: 240 },
      { personId: 'worker-b', payType: 'piece', amountDue: 350 },
    ],
  });
  const activityWrite = db.writes.find((write) => write.sql.includes('INSERT INTO activities'));
  assert.deepEqual(activityWrite?.params.slice(4, 10), ['2026-07-28T12:00:00.000Z', '2026-07-28', 'duration_only', null, null, 90]);
  const participantWrites = db.writes.filter((write) => write.sql.includes('INSERT INTO activity_participants'));
  assert.equal(participantWrites.length, 2, 'several workers must save as independent participant rows');
  assert.deepEqual(participantWrites.map((write) => write.params.slice(2, 5)), [['worker-a', 'hourly', 240], ['worker-b', 'piece', 350]], 'duration must not alter independently recorded pay values');
  const screen = await readFile(resolve(process.cwd(), 'src/features/operations/OperationalSliceScreen.tsx'), 'utf8');
  assert.equal(screen.includes('performedAtDraft') || screen.includes('setPerformedAtDraft'), false, 'removed raw-ISO state must not remain in the rendered Activity screen');
  console.log('ACTIVITY_TEMPORAL_CONTRACT_PASS: legacy, Bangkok-safe date-only, range, duration, and independent workers are valid');
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
