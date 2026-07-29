import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type SqlExecutor, runMigrations } from '../src/data/migrations';
import { TAKAI_MIGRATIONS } from '../src/data/schema';
import { createActivity, createHole, createPlanting, retireCurrentPlanting } from '../src/features/operations/repository';

class NodeSqliteExecutor implements SqlExecutor {
  constructor(private readonly database: DatabaseSync) {}
  async execAsync(sql: string): Promise<void> { this.database.exec(sql); }
  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> { return this.database.prepare(sql).all(...(params as SQLInputValue[])) as T[]; }
  async runAsync(sql: string, params: unknown[] = []): Promise<void> { this.database.prepare(sql).run(...(params as SQLInputValue[])); }
}

const applyThroughSeven = async (db: NodeSqliteExecutor): Promise<void> => {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.execAsync('CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
  for (const migration of TAKAI_MIGRATIONS.filter((item) => item.id <= 7)) {
    for (const statement of migration.statements) await db.execAsync(statement);
    await db.runAsync('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)', [migration.id, migration.name, '2026-07-28T00:00:00.000Z']);
  }
};

const activity = (id: string, holeId: string) => ({
  id,
  plotId: 'plot-lifecycle',
  categoryId: 'cat-lifecycle',
  performedAt: '2026-07-29T12:00:00.000Z',
  activityDate: '2026-07-29',
  timeMode: 'all_day' as const,
  note: 'ตรวจต้นไม้',
  targetType: 'hole' as const,
  targetId: holeId,
  materials: [],
  participants: [],
});

const plainRows = <T extends object>(rows: T[]): T[] => rows.map((row) => Object.assign({}, row));

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-lifecycle-'));
  try {
    const db = new NodeSqliteExecutor(new DatabaseSync(join(directory, 'takai.db')));
    await applyThroughSeven(db);
    await db.runAsync("INSERT INTO gardens (id, name, created_at) VALUES ('garden-lifecycle', 'สวนทดสอบ', '2026-01-01')");
    await db.runAsync("INSERT INTO plots (id, garden_id, name) VALUES ('plot-lifecycle', 'garden-lifecycle', 'แปลงทดสอบ')");
    await db.runAsync("INSERT INTO activity_categories (id, name, kind) VALUES ('cat-lifecycle', 'ตรวจต้น', 'note')");
    await db.runAsync("INSERT INTO holes (id, plot_id, marker, sort_key, status) VALUES ('hole-legacy', 'plot-lifecycle', 'L-001', 'L-001', 'empty')");
    await db.runAsync("INSERT INTO plantings (id, hole_id, plant_name, planted_on, removed_on) VALUES ('planting-legacy', 'hole-legacy', 'ต้นเก่า', '2020-01-01', '2021-01-01')");
    await db.runAsync("INSERT INTO activities (id, plot_id, category_id, performed_at, note, status) VALUES ('activity-legacy', 'plot-lifecycle', 'cat-lifecycle', '2020-01-02', 'legacy', 'done')");
    assert.deepEqual(await runMigrations(db), [8], 'a database already at migration 7 must receive only additive lifecycle migration 8');
    assert.deepEqual(plainRows(await db.getAllAsync<{ status: string; removed_reason: string | null }>('SELECT status, removed_reason FROM plantings WHERE id = ?', ['planting-legacy'])), [{ status: 'retired', removed_reason: null }], 'legacy ended planting must survive as retired');
    assert.deepEqual(plainRows(await db.getAllAsync<{ id: string; planting_id: string | null }>('SELECT id, planting_id FROM activities WHERE id = ?', ['activity-legacy'])), [{ id: 'activity-legacy', planting_id: null }], 'legacy activities must remain readable without invented planting identity');

    const holeId = await createHole(db, { plotId: 'plot-lifecycle', marker: 'L-002' }, '2026-07-29T10:00:00.000Z');
    const firstPlantingId = await createPlanting(db, { holeId, plantName: 'ทุเรียน', variety: 'หมอนทอง', plantedOn: '2026-07-01' }, '2026-07-29T10:01:00.000Z');
    await assert.rejects(createPlanting(db, { holeId, plantName: 'ซ้ำ', plantedOn: '2026-07-02' }), /unavailable for planting/, 'replant must be rejected until the current planting is retired');
    await createActivity(db, activity('activity-first-tree', holeId));
    await retireCurrentPlanting(db, { holeId, status: 'dead', removedOn: '2026-07-29', removedReason: 'โรคโคนเน่า' });
    assert.deepEqual(plainRows(await db.getAllAsync<{ status: string }>('SELECT status FROM holes WHERE id = ?', [holeId])), [{ status: 'empty' }], 'retirement must free the hole without archiving it');
    const secondPlantingId = await createPlanting(db, { holeId, plantName: 'ทุเรียน', variety: 'ชะนี', plantedOn: '2026-07-30' }, '2026-07-30T10:00:00.000Z');
    await createActivity(db, activity('activity-second-tree', holeId));
    assert.deepEqual(plainRows(await db.getAllAsync<{ id: string; status: string; removed_on: string | null; removed_reason: string | null }>('SELECT id, status, removed_on, removed_reason FROM plantings WHERE hole_id = ? ORDER BY planted_on', [holeId])), [
      { id: firstPlantingId, status: 'dead', removed_on: '2026-07-29', removed_reason: 'โรคโคนเน่า' },
      { id: secondPlantingId, status: 'active', removed_on: null, removed_reason: null },
    ], 'retirement and replant must preserve two distinct planting lifecycles');
    assert.deepEqual(plainRows(await db.getAllAsync<{ id: string; planting_id: string | null }>('SELECT id, planting_id FROM activities WHERE id IN (?, ?) ORDER BY id', ['activity-first-tree', 'activity-second-tree'])), [
      { id: 'activity-first-tree', planting_id: firstPlantingId },
      { id: 'activity-second-tree', planting_id: secondPlantingId },
    ], 'hole-targeted activities must retain the planting identity captured at save time');
    console.log('PLANTING_LIFECYCLE_CONTRACT_PASS: additive migration, atomic retirement/replant, and immutable activity identity are valid');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
