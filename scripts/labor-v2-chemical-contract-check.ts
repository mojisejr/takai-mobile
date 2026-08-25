import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import { TAKAI_MIGRATIONS } from '../src/data/schema';
import { archiveLaborV2Chemical, createLaborV2Chemical, getLaborV2ChemicalDetail, listLaborV2Chemicals, markLaborV2ChemicalEmpty, restoreLaborV2ChemicalAvailable, updateLaborV2Chemical } from '../src/features/labor-mvp';

class NodeSqliteExecutor implements SqlExecutor {
  constructor(private readonly database: DatabaseSync) {}
  async execAsync(sql: string): Promise<void> { this.database.exec(sql); }
  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> { return this.database.prepare(sql).all(...(params as SQLInputValue[])) as T[]; }
  async runAsync(sql: string, params: unknown[] = []): Promise<void> { this.database.prepare(sql).run(...(params as SQLInputValue[])); }
}

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-v2-chemical-')); let connection: DatabaseSync | null = null;
  try {
    connection = new DatabaseSync(join(directory, 'chemical.db')); const db = new NodeSqliteExecutor(connection);
    assert.deepEqual(await runMigrations(db), Array.from({ length: 20 }, (_, index) => index + 1), 'fresh notebook reaches chemical migration 20');
    const first = await createLaborV2Chemical(db, { id: 'mancozeb-older', commonName: 'แมนโคเซบ', brandName: 'แบรนด์เก่า', chemicalGroup: 'M03', referenceAmount: 300, referenceUnit: 'g', referenceWaterLitres: 200, addedOn: '2026-08-20' }, '2026-08-20T02:00:00.000Z');
    const latest = await createLaborV2Chemical(db, { id: 'mancozeb-latest', commonName: 'แมนโคเซบ', brandName: 'แบรนด์ใหม่', detail: 'ใช้กับทุเรียน', referenceAmount: 250, referenceUnit: 'g', referenceWaterLitres: 200, addedOn: '2026-08-24' }, '2026-08-24T02:00:00.000Z');
    assert.deepEqual((await listLaborV2Chemicals(db)).map((item) => [item.id, item.commonName, item.addedOn, item.status]), [[latest, 'แมนโคเซบ', '2026-08-24', 'available'], [first, 'แมนโคเซบ', '2026-08-20', 'available']], 'duplicate names persist as separate newest-first current items');
    await updateLaborV2Chemical(db, first, { brandName: 'แบรนด์เดิมแก้ชื่อ', reason: 'แก้ชื่อที่จดผิด' }, '2026-08-25T02:00:00.000Z');
    assert.deepEqual((await getLaborV2ChemicalDetail(db, first)).revisions.map((revision) => [revision.revision, revision.action, revision.reason]), [[2, 'updated', 'แก้ชื่อที่จดผิด'], [1, 'created', null]], 'chemical edits append an immutable reasoned revision');
    await markLaborV2ChemicalEmpty(db, latest, 'ใช้หมดแล้ว', '2026-08-25T03:00:00.000Z');
    assert.deepEqual((await listLaborV2Chemicals(db)).map((item) => [item.id, item.status]), [[first, 'available'], [latest, 'empty']], 'manual empty moves the item behind available without deleting it');
    await restoreLaborV2ChemicalAvailable(db, latest, 'ซื้อมาเพิ่มแล้ว', '2026-08-25T04:00:00.000Z');
    await archiveLaborV2Chemical(db, latest, 'เลิกใช้สูตรนี้', '2026-08-25T05:00:00.000Z');
    assert.deepEqual((await listLaborV2Chemicals(db)).map((item) => item.id), [first], 'archived chemical is unavailable to future active recommendations');
    assert.equal((await getLaborV2ChemicalDetail(db, latest)).revisions[0]?.action, 'archived', 'archive remains readable as chemical history');
    await assert.rejects(markLaborV2ChemicalEmpty(db, first, '  '), /requires a reason/, 'manual stock state needs a reason');
    await assert.rejects(createLaborV2Chemical(db, { commonName: 'ไม่ครบ', referenceAmount: 0, referenceUnit: 'g', referenceWaterLitres: 200, addedOn: '2026-08-25' }), /reference amount/, 'dose reference must be positive');
    await assert.rejects(db.runAsync("UPDATE labor_v2_chemical_revisions SET reason = 'rewrite' WHERE chemical_id = ?", [first]), /immutable/, 'revision ledger rejects rewrite');
    const legacyTables = await db.getAllAsync<{ count: number }>("SELECT count(*) AS count FROM activity_materials"); assert.equal(legacyTables[0]?.count, 0, 'V2 chemical writes never import retired V1 material facts');
    const upgrade = new DatabaseSync(join(directory, 'upgrade.db')); const upgradeDb = new NodeSqliteExecutor(upgrade); await upgradeDb.execAsync('PRAGMA foreign_keys = ON'); await upgradeDb.execAsync('CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
    for (const migration of TAKAI_MIGRATIONS.filter((migration) => migration.id <= 19)) { for (const statement of migration.statements) await upgradeDb.execAsync(statement); await upgradeDb.runAsync('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)', [migration.id, migration.name, '2026-08-24T00:00:00.000Z']); }
    assert.deepEqual(await runMigrations(upgradeDb), [20], 'migration-19 notebook upgrades through one additive chemical migration'); upgrade.close();
    console.log('LABOR_V2_CHEMICAL_PASS: additive chemical library, duplicate records, reasoned status history, V1 boundary, and migration upgrade are deterministic');
  } finally { connection?.close(); await rm(directory, { recursive: true, force: true }); }
};
main().catch((error: unknown) => { console.error(error); process.exit(1); });
