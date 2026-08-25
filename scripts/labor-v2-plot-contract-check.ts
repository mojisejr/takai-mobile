import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import { TAKAI_MIGRATIONS } from '../src/data/schema';
import { archiveLaborV2Plot, createLaborV2Plot, createLaborWorker, getLaborV2PlotDetail, listLaborV2Plots, recordLaborDayV2, restoreLaborV2Plot, updateLaborV2Plot } from '../src/features/labor-mvp';
import { getLaborV2ReadModel } from '../src/features/labor-mvp/repositoryV2';

class NodeSqliteExecutor implements SqlExecutor {
  constructor(private readonly database: DatabaseSync) {}
  async execAsync(sql: string): Promise<void> { this.database.exec(sql); }
  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> { return this.database.prepare(sql).all(...(params as SQLInputValue[])) as T[]; }
  async runAsync(sql: string, params: unknown[] = []): Promise<void> { this.database.prepare(sql).run(...(params as SQLInputValue[])); }
}

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-v2-plot-')); let connection: DatabaseSync | null = null;
  try {
    connection = new DatabaseSync(join(directory, 'takai.db')); const db = new NodeSqliteExecutor(connection);
    assert.deepEqual(await runMigrations(db), Array.from({ length: 21 }, (_, index) => index + 1), 'fresh database reaches the additive V2 plot, chemical, and task-mix migrations');
    const v2Tables = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('labor_v2_plots', 'labor_v2_plot_revisions', 'labor_v2_task_plot_targets', 'labor_v2_task_plot_tree_refs') ORDER BY name");
    assert.deepEqual(v2Tables.map((row) => row.name), ['labor_v2_plot_revisions', 'labor_v2_plots', 'labor_v2_task_plot_targets', 'labor_v2_task_plot_tree_refs'], 'plot context remains a V2-only data island');
    const su = await createLaborWorker(db, { id: 'su', displayName: 'สุ' });
    const north = await createLaborV2Plot(db, { id: 'north', name: 'แปลง A', cropLabel: 'ทุเรียน', latitude: 13.7563, longitude: 100.5018 }, '2026-08-24T01:00:00.000Z');
    const east = await createLaborV2Plot(db, { id: 'east', name: 'แปลง B' }, '2026-08-24T01:01:00.000Z');
    assert.deepEqual((await listLaborV2Plots(db)).map((plot) => [plot.id, plot.name, plot.archivedAt]), [[north, 'แปลง A', null], [east, 'แปลง B', null]], 'active plots list with optional coordinates/crop only');
    await recordLaborDayV2(db, {
      workDate: '2026-08-24',
      tasks: [
        { id: 'spray-north-east', title: 'พ่นยา', assigneePersonIds: [su], plotTargets: [{ plotId: north, treeLabels: ['A-014', 'ต้นริมรั้ว'] }, { plotId: east, treeLabels: ['B-002'] }] },
        { id: 'general', title: 'ซ่อมอุปกรณ์', assigneePersonIds: [su] },
      ],
      daily: [{ id: 'su-day', personId: su, rateSatang: 35_000, quantityMilli: 1000, taskIds: ['spray-north-east', 'general'] }],
    }, '2026-08-24T02:00:00.000Z');
    const targets = await db.getAllAsync<{ task_id: string; plot_id: string; plot_name_snapshot: string; sort_order: number }>('SELECT task_id, plot_id, plot_name_snapshot, sort_order FROM labor_v2_task_plot_targets ORDER BY sort_order');
    assert.deepEqual(targets.map((target) => ({ ...target })), [{ task_id: 'spray-north-east', plot_id: north, plot_name_snapshot: 'แปลง A', sort_order: 0 }, { task_id: 'spray-north-east', plot_id: east, plot_name_snapshot: 'แปลง B', sort_order: 1 }], 'one task can atomically preserve several plot snapshots');
    assert.deepEqual((await db.getAllAsync<{ tree_label: string }>('SELECT tree_label FROM labor_v2_task_plot_tree_refs ORDER BY tree_label')).map((row) => row.tree_label), ['A-014', 'B-002', 'ต้นริมรั้ว'], 'tree references live only beneath selected targets');
    assert.equal((await getLaborV2ReadModel(db)).obligations.find((item) => item.id === 'obligation:daily:su-day')?.dueSatang, 35_000, 'targets leave daily compensation exactly unchanged');
    await updateLaborV2Plot(db, north, { name: 'แปลงทุเรียนโซนเหนือ', reason: 'ตั้งชื่อตามชนิดพืช' }, '2026-08-24T03:00:00.000Z');
    const detail = await getLaborV2PlotDetail(db, north);
    assert.deepEqual(detail.revisions.map((revision) => [revision.revision, revision.action, revision.reason]), [[2, 'updated', 'ตั้งชื่อตามชนิดพืช'], [1, 'created', null]], 'rename is reasoned and append-only');
    assert.equal((await db.getAllAsync<{ plot_name_snapshot: string }>('SELECT plot_name_snapshot FROM labor_v2_task_plot_targets WHERE plot_id = ?', [north]))[0]?.plot_name_snapshot, 'แปลง A', 'rename never rewrites historical task snapshot');
    await archiveLaborV2Plot(db, east, 'ย้ายไปรวมโซนเหนือ', '2026-08-24T04:00:00.000Z');
    assert.deepEqual((await listLaborV2Plots(db)).map((plot) => plot.id), [north], 'archived plot leaves new active selection without destroying history');
    const taskCountBeforeRejectedTarget = (await db.getAllAsync<{ count: number }>('SELECT count(*) AS count FROM labor_v2_work_tasks'))[0]!.count;
    await assert.rejects(recordLaborDayV2(db, { workDate: '2026-08-25', tasks: [{ id: 'invalid-archived-target', title: 'พ่นยา', assigneePersonIds: [su], plotTargets: [{ plotId: east }] }] }), /unavailable or archived/, 'archive blocks future task target selection');
    assert.equal((await db.getAllAsync<{ count: number }>('SELECT count(*) AS count FROM labor_v2_work_tasks'))[0]!.count, taskCountBeforeRejectedTarget, 'a rejected target write leaves no partial task');
    await assert.rejects(createLaborV2Plot(db, { name: 'พิกัดไม่ครบ', latitude: 13.7 }), /require both/, 'partial coordinates reject before creation');
    await assert.rejects(recordLaborDayV2(db, { workDate: '2026-08-25', tasks: [{ title: 'ต้นซ้ำ', assigneePersonIds: [su], plotTargets: [{ plotId: north, treeLabels: ['A-1', 'A-1'] }] }] }), /distinct and nonblank/, 'duplicate tree labels reject atomically');
    await assert.rejects(archiveLaborV2Plot(db, north, '   '), /requires a reason/, 'archive requires a reason');
    await assert.rejects(db.runAsync("UPDATE labor_v2_plot_revisions SET reason = 'rewrite' WHERE plot_id = ?", [north]), /immutable/, 'database guard forbids rewriting plot revision history');
    await restoreLaborV2Plot(db, east, 'กลับมาใช้งานอีกครั้ง', '2026-08-24T05:00:00.000Z');
    assert.equal((await getLaborV2PlotDetail(db, east)).revisions[0]?.action, 'restored', 'restore appends history rather than deleting archive');

    const upgrade = new DatabaseSync(join(directory, 'upgrade.db')); const upgradeDb = new NodeSqliteExecutor(upgrade);
    await upgradeDb.execAsync('PRAGMA foreign_keys = ON'); await upgradeDb.execAsync('CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
    for (const migration of TAKAI_MIGRATIONS.filter((migration) => migration.id <= 18)) { for (const statement of migration.statements) await upgradeDb.execAsync(statement); await upgradeDb.runAsync('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)', [migration.id, migration.name, '2026-08-23T00:00:00.000Z']); }
    assert.deepEqual(await runMigrations(upgradeDb), [19, 20, 21], 'migration-18 notebooks upgrade through additive plot, chemical, and task-mix migrations'); upgrade.close();
    console.log('LABOR_V2_PLOT_PASS: V2 plot context, revisions, optional task targets, free-text tree refs, and archive safeguards are deterministic');
  } finally { connection?.close(); await rm(directory, { recursive: true, force: true }); }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
