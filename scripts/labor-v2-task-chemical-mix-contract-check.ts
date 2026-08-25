import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import { TAKAI_MIGRATIONS } from '../src/data/schema';
import { archiveLaborV2Chemical, createLaborV2Chemical, createLaborV2Plot, createLaborWorker, getLaborV2ChemicalDetail, getLaborV2ReadModel, recordLaborDayV2, updateLaborV2Chemical } from '../src/features/labor-mvp';

class NodeSqliteExecutor implements SqlExecutor {
  constructor(private readonly database: DatabaseSync) {}
  async execAsync(sql: string): Promise<void> { this.database.exec(sql); }
  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> { return this.database.prepare(sql).all(...(params as SQLInputValue[])) as T[]; }
  async runAsync(sql: string, params: unknown[] = []): Promise<void> { this.database.prepare(sql).run(...(params as SQLInputValue[])); }
}

const count = async (db: SqlExecutor, table: string): Promise<number> => Number((await db.getAllAsync<{ count: number }>(`SELECT count(*) AS count FROM ${table}`))[0]?.count ?? 0);

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-v2-task-chemical-mix-')); let connection: DatabaseSync | null = null;
  try {
    connection = new DatabaseSync(join(directory, 'task-chemical-mix.db')); const db = new NodeSqliteExecutor(connection);
    assert.deepEqual(await runMigrations(db), Array.from({ length: 21 }, (_, index) => index + 1), 'fresh notebook reaches task-mix migration 21');
    const su = await createLaborWorker(db, { id: 'su', displayName: 'สุ' });
    const north = await createLaborV2Plot(db, { id: 'north', name: 'แปลงเหนือ' }, '2026-08-25T00:30:00.000Z');
    const pond = await createLaborV2Plot(db, { id: 'pond', name: 'แปลงบ่อ' }, '2026-08-25T00:30:00.000Z');
    const mancozeb = await createLaborV2Chemical(db, { id: 'mancozeb', commonName: 'แมนโคเซบ', referenceAmount: 300, referenceUnit: 'g', referenceWaterLitres: 200, addedOn: '2026-08-25' }, '2026-08-25T01:00:00.000Z');
    await recordLaborDayV2(db, {
      workDate: '2026-08-25',
      tasks: [{ id: 'spray', title: 'พ่นยารอบเช้า', assigneePersonIds: [su], chemicalMix: { waterLitres: 50, uses: [
        { chemicalId: mancozeb },
        { quickAdd: { commonName: 'อะบาเม็กติน', referenceAmount: 20, referenceUnit: 'cc', referenceWaterLitres: 200, addedOn: '2026-08-25' }, markEmpty: true, emptyReason: 'ใช้หมดแล้วหลังพ่นรอบเช้า' },
      ] } }, { id: 'general', title: 'เก็บอุปกรณ์', assigneePersonIds: [su], plotTargets: [{ plotId: north, treeLabels: ['N-01'] }, { plotId: pond, treeLabels: ['P-01'] }] }],
      daily: [{ id: 'su-day', personId: su, rateSatang: 35_000, quantityMilli: 1000, taskIds: ['spray', 'general'] }],
    }, '2026-08-25T02:00:00.000Z');
    const task = (await getLaborV2ReadModel(db)).tasks.find((item) => item.id === 'spray');
    assert.deepEqual(task?.chemicalMix, { waterLitres: 50, uses: [
      { chemicalId: mancozeb, commonName: 'แมนโคเซบ', referenceAmount: 300, referenceUnit: 'g', referenceWaterLitres: 200, calculatedAmount: 75, wasMarkedEmpty: false },
      { chemicalId: task?.chemicalMix?.uses[1]?.chemicalId!, commonName: 'อะบาเม็กติน', referenceAmount: 20, referenceUnit: 'cc', referenceWaterLitres: 200, calculatedAmount: 5, wasMarkedEmpty: true },
    ] }, 'one shared water total snapshots several dose references and calculated amounts');
    assert.equal((await db.getAllAsync<{ status: string }>("SELECT status FROM labor_v2_chemical_items WHERE common_name = 'อะบาเม็กติน'"))[0]?.status, 'empty', 'explicit use-empty mark changes only that item status');
    assert.equal((await db.getAllAsync<{ status: string }>('SELECT status FROM labor_v2_chemical_items WHERE id = ?', [mancozeb]))[0]?.status, 'available', 'unchecked use never changes chemical status');
    await updateLaborV2Chemical(db, mancozeb, { commonName: 'แมนโคเซบ สูตรใหม่', referenceAmount: 600, referenceUnit: 'g', referenceWaterLitres: 200, reason: 'เปลี่ยนสูตรในคลัง' }, '2026-08-26T01:00:00.000Z');
    await archiveLaborV2Chemical(db, mancozeb, 'เลิกเก็บสูตรเดิม', '2026-08-26T02:00:00.000Z');
    const archivedHistory = await getLaborV2ChemicalDetail(db, mancozeb);
    assert.deepEqual(archivedHistory.usages, [{ taskId: 'spray', workDate: '2026-08-25', taskTitle: 'พ่นยารอบเช้า', waterLitres: 50, commonName: 'แมนโคเซบ', referenceAmount: 300, referenceUnit: 'g', referenceWaterLitres: 200, calculatedAmount: 75, wasMarkedEmpty: false }], 'chemical detail reads the immutable task-use snapshot after catalog edit/archive');
    assert.equal(archivedHistory.lastUsedOn, '2026-08-25', 'last-used date derives from effective work date, not catalog audit time');
    assert.equal((await getLaborV2ReadModel(db)).tasks.find((item) => item.id === 'spray')?.chemicalMix?.uses[0]?.commonName, 'แมนโคเซบ', 'task detail also preserves the original name after a catalog edit');
    assert.equal((await getLaborV2ReadModel(db)).tasks.find((item) => item.id === 'general')?.chemicalMix, undefined, 'a task without a mix preserves ordinary task-save behavior');
    assert.equal((await getLaborV2ReadModel(db)).tasks.find((item) => item.id === 'general')?.plotTargets.length, 2, 'ordinary non-chemical work may still span multiple plots');
    const beforeTasks = await count(db, 'labor_v2_work_tasks'); const beforeChemicals = await count(db, 'labor_v2_chemical_items');
    await assert.rejects(recordLaborDayV2(db, { workDate: '2026-08-26', tasks: [{ title: 'พ่นข้ามแปลง', assigneePersonIds: [su], plotTargets: [{ plotId: north }, { plotId: pond }], chemicalMix: { waterLitres: 20, uses: [{ quickAdd: { commonName: 'ยาไม่ควรถูกสร้าง', referenceAmount: 10, referenceUnit: 'g', referenceWaterLitres: 200, addedOn: '2026-08-26' } }] } }] }), /งานที่ใส่ยาเลือกได้ 1 แปลงเท่านั้น/, 'chemical mix spanning two plots rejects with separate-task guidance');
    assert.equal(await count(db, 'labor_v2_work_tasks'), beforeTasks, 'two-plot chemical mix rolls back task facts'); assert.equal(await count(db, 'labor_v2_chemical_items'), beforeChemicals, 'two-plot chemical mix leaves no orphan quick chemical');
    await assert.rejects(recordLaborDayV2(db, { workDate: '2026-08-26', tasks: [{ title: 'สูตรผิด', assigneePersonIds: [su], chemicalMix: { waterLitres: 20, uses: [{ quickAdd: { commonName: 'ยาไม่ครบ', referenceAmount: 10, referenceUnit: '', referenceWaterLitres: 200, addedOn: '2026-08-26' } }] } }] }), /reference unit/, 'invalid quick chemical unit rejects');
    assert.equal(await count(db, 'labor_v2_work_tasks'), beforeTasks, 'invalid quick chemical rolls back task facts'); assert.equal(await count(db, 'labor_v2_chemical_items'), beforeChemicals, 'invalid quick chemical leaves no orphan library item');
    await assert.rejects(recordLaborDayV2(db, { workDate: '2026-08-26', tasks: [{ title: 'ไม่มีรายการ', assigneePersonIds: [su], chemicalMix: { waterLitres: 20, uses: [] } }] }), /at least one chemical/, 'empty mix rejects atomically');
    await assert.rejects(recordLaborDayV2(db, { workDate: '2026-08-26', tasks: [{ title: 'เลือกซ้ำ', assigneePersonIds: [su], chemicalMix: { waterLitres: 20, uses: [{ chemicalId: mancozeb }, { chemicalId: mancozeb }] } }] }), /distinct per task/, 'duplicate chemical use rejects atomically');
    const upgrade = new DatabaseSync(join(directory, 'upgrade.db')); const upgradeDb = new NodeSqliteExecutor(upgrade); await upgradeDb.execAsync('PRAGMA foreign_keys = ON'); await upgradeDb.execAsync('CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
    for (const migration of TAKAI_MIGRATIONS.filter((migration) => migration.id <= 20)) { for (const statement of migration.statements) await upgradeDb.execAsync(statement); await upgradeDb.runAsync('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)', [migration.id, migration.name, '2026-08-25T00:00:00.000Z']); }
    assert.deepEqual(await runMigrations(upgradeDb), [21], 'migration-20 notebook upgrades through one additive task-mix migration'); upgrade.close();
    console.log('LABOR_V2_TASK_CHEMICAL_MIX_PASS: optional shared-water mixes, quick-add, snapshot arithmetic, manual empty state, and atomic failures are deterministic');
  } finally { connection?.close(); await rm(directory, { recursive: true, force: true }); }
};
main().catch((error: unknown) => { console.error(error); process.exit(1); });
