import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { type SqlExecutor, runMigrations } from '../src/data/migrations';
import { seedDemoGarden } from '../src/data/seed';
import { localDateKey } from '../src/date';
import { validateActivityDraft } from '../src/features/operations/activityValidation';
import { createActivity, getTodayDashboard } from '../src/features/operations/repository';

class NodeSqliteExecutor implements SqlExecutor {
  constructor(private readonly database: DatabaseSync) {}

  async execAsync(sql: string): Promise<void> {
    this.database.exec(sql);
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.database.prepare(sql).all(...(params as SQLInputValue[])) as T[];
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    this.database.prepare(sql).run(...(params as SQLInputValue[]));
  }
}

const activityInput = {
  id: 'activity-sqlite-roundtrip',
  plotId: 'plot-a',
  categoryId: 'cat-spray',
  performedAt: '2026-07-29T12:00:00.000Z',
  timeMode: 'all_day' as const,
  activityDate: '2026-07-29',
  note: 'ตรวจ SQLite roundtrip',
  followUpOn: '2026-08-02',
  targetType: 'plot' as const,
  targetId: 'plot-a',
  materials: [],
  participants: [],
};

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-activity-'));
  const databasePath = join(directory, 'takai-local.db');
  try {
    const firstConnection = new DatabaseSync(databasePath);
    const firstDb = new NodeSqliteExecutor(firstConnection);
    await runMigrations(firstDb);
    await seedDemoGarden(firstDb);
    await createActivity(firstDb, activityInput);
    firstConnection.close();

    const secondConnection = new DatabaseSync(databasePath);
    const secondDb = new NodeSqliteExecutor(secondConnection);
    const rows = await secondDb.getAllAsync<{
      id: string;
      activity_date: string;
      time_mode: string;
      started_at: string | null;
      ended_at: string | null;
      duration_minutes: number | null;
      follow_up_on: string | null;
    }>('SELECT id, activity_date, time_mode, started_at, ended_at, duration_minutes, follow_up_on FROM activities WHERE id = ?', [activityInput.id]);
    assert.deepEqual(rows.map((row) => ({ ...row })), [{
      id: activityInput.id,
      activity_date: '2026-07-29',
      time_mode: 'all_day',
      started_at: null,
      ended_at: null,
      duration_minutes: null,
      follow_up_on: '2026-08-02',
    }], 'valid all-day activity must survive a close/reopen SQLite roundtrip');
    const today = await getTodayDashboard(secondDb, 'plot-a');
    assert.ok(today.recentItems.some((item) => item.id === activityInput.id), 'reloaded dashboard must expose the saved activity');

    const countBeforeInvalidSaves = await secondDb.getAllAsync<{ count: number }>('SELECT count(*) AS count FROM activities');
    await assert.rejects(
      createActivity(secondDb, { ...activityInput, id: 'activity-blank-material', materials: [{ materialId: '', amount: 1, unit: 'cc' }] }),
      /material is unavailable/,
      'repository must reject blank material IDs before writing an activity',
    );
    await assert.rejects(
      createActivity(secondDb, { ...activityInput, id: 'activity-blank-worker', participants: [{ personId: '', payType: 'daily', amountDue: 500 }] }),
      /activity participant is unavailable/,
      'repository must reject blank worker IDs before writing an activity',
    );
    const countAfterInvalidSaves = await secondDb.getAllAsync<{ count: number }>('SELECT count(*) AS count FROM activities');
    assert.deepEqual(countAfterInvalidSaves, countBeforeInvalidSaves, 'invalid rows must never reach SQLite');
    secondConnection.close();

    const validationErrors = validateActivityDraft({
      activityDate: 'not-a-date',
      timeMode: 'time_range',
      startedAt: '10:00',
      endedAt: '09:00',
      durationMinutes: '',
      materials: [{ materialId: '' }],
      workers: [{ personId: '', payType: 'daily', amount: '' }],
    });
    assert.ok(validationErrors.some((error) => error.includes('activity date')), 'invalid date/time must have a named validation error');
    assert.ok(validationErrors.some((error) => error.startsWith('วัสดุ 1:')), 'blank material must have a named validation error');
    assert.ok(validationErrors.some((error) => error.startsWith('คนงาน 1:')), 'blank worker must have a named validation error');
    assert.equal(localDateKey(new Date('2026-07-29T00:30:00+07:00')), '2026-07-29', 'Bangkok-midnight date selection must retain the local calendar day');

    const [screen, dateSource] = await Promise.all([
      readFile(resolve(process.cwd(), 'src/features/operations/OperationalSliceScreen.tsx'), 'utf8'),
      readFile(resolve(process.cwd(), 'src/features/operations/date.ts'), 'utf8'),
    ]);
    assert.ok(screen.includes("status: 'saving'") && screen.includes('กำลังบันทึก…'), 'save control must lock and communicate saving state');
    assert.ok(screen.includes("status: 'error'") && screen.includes('บันทึกสำเร็จ') && screen.includes('เลขที่บันทึก:'), 'error and success receipt must be visible in the Activity form');
    assert.equal(dateSource.includes('DEMO_NOW'), false, 'production operation dates must not be frozen to demo time');
    console.log('ACTIVITY_TRUTH_CONTRACT_PASS: real SQLite roundtrip, blank-row rejection, local dates, and save-state feedback are valid');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
