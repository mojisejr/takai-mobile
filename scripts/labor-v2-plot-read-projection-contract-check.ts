import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import { archiveLaborV2Plot, createLaborV2Plot, createLaborWorker, getCalendarMonthV2, getLaborV2Calendar, getLaborV2ReadModel, getLaborV2Today, getPersonDetailV2, getTaskDetailV2, getWorkListV2, listLaborV2Plots, recordLaborDayV2, updateLaborV2Plot } from '../src/features/labor-mvp';

class NodeSqliteExecutor implements SqlExecutor {
  constructor(private readonly database: DatabaseSync) {}
  async execAsync(sql: string): Promise<void> { this.database.exec(sql); }
  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> { return this.database.prepare(sql).all(...(params as SQLInputValue[])) as T[]; }
  async runAsync(sql: string, params: unknown[] = []): Promise<void> { this.database.prepare(sql).run(...(params as SQLInputValue[])); }
}

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-v2-plot-read-')); let connection: DatabaseSync | null = null;
  try {
    connection = new DatabaseSync(join(directory, 'takai.db')); const db = new NodeSqliteExecutor(connection); await runMigrations(db);
    const su = await createLaborWorker(db, { id: 'su', displayName: 'สุ' });
    const north = await createLaborV2Plot(db, { id: 'north', name: 'แปลง A', cropLabel: 'ทุเรียน', latitude: 13.7563, longitude: 100.5018 }, '2026-08-24T01:00:00.000Z');
    const east = await createLaborV2Plot(db, { id: 'east', name: 'แปลง B', cropLabel: 'มังคุด' }, '2026-08-24T01:01:00.000Z');
    await recordLaborDayV2(db, { workDate: '2026-08-24', tasks: [
      { id: 'spray', title: 'พ่นยา', assigneePersonIds: [su], plotTargets: [{ plotId: north, treeLabels: ['A-014', 'ต้นริมรั้ว'] }, { plotId: east, treeLabels: ['B-002'] }] },
      { id: 'general', title: 'ซ่อมอุปกรณ์', assigneePersonIds: [su] },
    ], daily: [{ id: 'su-day', personId: su, rateSatang: 35_000, quantityMilli: 1000, taskIds: ['spray', 'general'] }] }, '2026-08-24T02:00:00.000Z');
    await updateLaborV2Plot(db, north, { name: 'แปลงทุเรียนโซนเหนือ', reason: 'ตั้งชื่อตามชนิดพืช' }, '2026-08-24T03:00:00.000Z');
    await archiveLaborV2Plot(db, east, 'ย้ายไปรวมโซนเหนือ', '2026-08-24T04:00:00.000Z');

    const expectedTargets = [
      { plotId: north, currentName: 'แปลงทุเรียนโซนเหนือ', recordedName: 'แปลง A', wasRenamed: true, treeLabels: ['A-014', 'ต้นริมรั้ว'] },
      { plotId: east, currentName: 'แปลง B', recordedName: 'แปลง B', wasRenamed: false, treeLabels: ['B-002'] },
    ];
    const model = await getLaborV2ReadModel(db);
    assert.deepEqual(model.tasks.find((task) => task.id === 'spray')?.plotTargets, expectedTargets, 'read model resolves current names, preserved snapshots, rename state, and ordered tree labels');
    assert.deepEqual(model.tasks.find((task) => task.id === 'general')?.plotTargets, [], 'general work remains an explicit no-plot task fact');
    assert.equal(model.obligations.find((item) => item.id === 'obligation:daily:su-day')?.dueSatang, 35_000, 'plot reads never alter the daily obligation');

    const [detail, list, today, person, calendar, month] = await Promise.all([
      getTaskDetailV2(db, 'spray'),
      getWorkListV2(db, { startDate: '2026-08-24', endDate: '2026-08-24' }),
      getLaborV2Today(db, '2026-08-24'),
      getPersonDetailV2(db, su),
      getLaborV2Calendar(db, '2026-08-24', '2026-08-24'),
      getCalendarMonthV2(db, '2026-08'),
    ]);
    assert.deepEqual(detail.plotTargets, expectedTargets, 'task detail keeps historical plot target facts');
    assert.deepEqual(list.items.find((task) => task.id === 'spray')?.plotTargets, expectedTargets, 'work list carries typed plot target facts');
    assert.deepEqual(today.tasks.find((task) => task.id === 'spray')?.plotTargets, expectedTargets, 'today carries typed plot target facts');
    assert.deepEqual(person.tasks.find((task) => task.id === 'spray')?.plotTargets, expectedTargets, 'person history carries typed plot target facts');
    assert.deepEqual(calendar.days[0]?.tasks.find((task) => task.id === 'spray')?.plotTargets, expectedTargets, 'calendar day detail carries typed plot target facts');
    assert.deepEqual(month.days[23]?.tasks.find((task) => task.id === 'spray')?.plotTargets, expectedTargets, 'calendar month day detail carries typed plot target facts');

    assert.deepEqual((await listLaborV2Plots(db)).map((plot) => plot.id), [north], 'plot list defaults to active plots for future selection');
    const all = await listLaborV2Plots(db, true);
    assert.deepEqual(all.map((plot) => [plot.id, plot.archivedAt !== null]), [[north, false], [east, true]], 'archived plots are opt-in while historical task targets remain readable');
    console.log('LABOR_V2_PLOT_READ_PROJECTION_PASS: V2 task/list/today/person/calendar plot projections preserve current, recorded, renamed, archived, and no-plot facts');
  } finally { connection?.close(); await rm(directory, { recursive: true, force: true }); }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
