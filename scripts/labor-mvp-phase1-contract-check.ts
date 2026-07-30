import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import { TAKAI_MIGRATIONS } from '../src/data/schema';
import {
  createLaborWorker,
  createNormalWork,
  archiveLaborWorker,
  editLaborPayment,
  getLaborMvpReadModel,
  listLaborPayables,
  listLaborTimeline,
  postLaborPayment,
  updateLaborWorker,
} from '../src/features/labor-mvp';

class NodeSqliteExecutor implements SqlExecutor {
  constructor(private readonly database: DatabaseSync) {}
  async execAsync(sql: string): Promise<void> { this.database.exec(sql); }
  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.database.prepare(sql).all(...(params as SQLInputValue[])) as T[];
  }
  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    this.database.prepare(sql).run(...(params as SQLInputValue[]));
  }
}

const applyThroughEight = async (db: NodeSqliteExecutor): Promise<void> => {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.execAsync('CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
  for (const migration of TAKAI_MIGRATIONS.filter((item) => item.id <= 8)) {
    for (const statement of migration.statements) await db.execAsync(statement);
    await db.runAsync('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)', [migration.id, migration.name, '2026-07-30T00:00:00.000Z']);
  }
};

const count = async (db: NodeSqliteExecutor, table: string): Promise<number> => {
  const rows = await db.getAllAsync<{ count: number }>(`SELECT count(*) AS count FROM ${table}`);
  return Number(rows[0]?.count ?? 0);
};

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-labor-mvp-phase1-'));
  const databasePath = join(directory, 'takai.db');
  let firstConnection: DatabaseSync | null = null;
  let secondConnection: DatabaseSync | null = null;
  try {
    firstConnection = new DatabaseSync(databasePath);
    const db = new NodeSqliteExecutor(firstConnection);
    await applyThroughEight(db);
    await db.runAsync("INSERT INTO gardens (id, name, created_at) VALUES ('garden-legacy', 'สวนเดิม', '2025-01-01')");
    await db.runAsync("INSERT INTO plots (id, garden_id, name) VALUES ('plot-legacy', 'garden-legacy', 'แปลงเดิม')");
    await db.runAsync("INSERT INTO activity_categories (id, name, kind) VALUES ('category-legacy', 'งานเดิม', 'note')");
    await db.runAsync("INSERT INTO activities (id, plot_id, category_id, performed_at, note, status) VALUES ('activity-legacy', 'plot-legacy', 'category-legacy', '2025-01-01T00:00:00.000Z', 'ไม่แตะ', 'done')");
    await db.runAsync("INSERT INTO people (id, display_name, role, is_self, specialty, phone, note) VALUES ('owner-self', 'เจ้าของสวน', 'owner', 1, '', '', '')");
    const legacyCounts = { activities: await count(db, 'activities'), laborEntries: await count(db, 'labor_entries') };

    assert.deepEqual(await runMigrations(db), [9, 10, 11, 12], 'a schema-8 fixture must receive only additive Labor MVP migrations');
    assert.deepEqual({ activities: await count(db, 'activities'), laborEntries: await count(db, 'labor_entries') }, legacyCounts, 'Labor MVP migration must leave legacy garden and labor rows untouched');
    assert.equal((await db.getAllAsync<{ plot_id: string | null }>("SELECT plot_id FROM labor_jobs WHERE id = 'none'"))[0], undefined, 'new labor jobs are isolated from the legacy activity table');

    const somchai = await createLaborWorker(db, { id: 'worker-somchai', displayName: 'สมชาย', specialty: 'ตัดหญ้า' });
    const malee = await createLaborWorker(db, { id: 'worker-malee', displayName: 'มาลี', phone: '0812345678' });
    const work = await createNormalWork(db, {
      id: 'job-mow', title: 'ตัดหญ้า', workDate: '2026-07-30', note: 'งานรวม',
      participants: [
        { personId: 'owner-self' },
        { personId: somchai, dueSatang: 50_000, payType: 'daily' },
        { personId: malee, dueSatang: 45_000, payType: 'daily' },
      ],
    }, '2026-07-30T01:00:00.000Z');
    assert.equal(work.payableIds.length, 2, 'self participation must not create a payable');
    const initialPayables = await listLaborPayables(db);
    assert.deepEqual(initialPayables.map((payable) => [payable.personId, payable.dueSatang, payable.remainingSatang]).sort(), [
      ['worker-malee', 45_000, 45_000], ['worker-somchai', 50_000, 50_000],
    ], 'no-plot normal work must create independent worker balances in satang');

    const somchaiPayable = initialPayables.find((payable) => payable.personId === somchai)!;
    const maleePayable = initialPayables.find((payable) => payable.personId === malee)!;
    const paymentId = await postLaborPayment(db, {
      id: 'payment-somchai-1', personId: somchai, paymentDate: '2026-07-30', method: 'cash',
      allocations: [{ payableId: somchaiPayable.id, amountSatang: 20_000 }],
    }, '2026-07-30T02:00:00.000Z');
    assert.equal(paymentId, 'payment-somchai-1');
    assert.equal((await listLaborPayables(db, somchai))[0]?.remainingSatang, 30_000, 'partial payment must retain the exact remaining balance');

    const eventsBeforeRejectedCommands = await count(db, 'timeline_events');
    await assert.rejects(
      postLaborPayment(db, { personId: somchai, paymentDate: '2026-07-30', allocations: [{ payableId: maleePayable.id, amountSatang: 1_000 }] }),
      /payee must match/,
      'a receipt must not allocate another worker payable',
    );
    await assert.rejects(
      postLaborPayment(db, { personId: somchai, paymentDate: '2026-07-30', allocations: [{ payableId: somchaiPayable.id, amountSatang: 30_001 }] }),
      /cannot exceed/,
      'a receipt must not overpay a payable',
    );
    await assert.rejects(
      postLaborPayment(db, { personId: somchai, paymentDate: '2026-07-30', allocations: [{ payableId: somchaiPayable.id, amountSatang: 10.5 }] }),
      /INTEGER satang/,
      'new money must be a whole-satang integer',
    );
    assert.equal(await count(db, 'timeline_events'), eventsBeforeRejectedCommands, 'failed payments must create no timeline event');

    await assert.rejects(
      archiveLaborWorker(db, malee, '   '),
      /requires a reason/,
      'worker archival requires a reason',
    );
    await assert.rejects(
      updateLaborWorker(db, somchai, { specialty: 'ตัดหญ้าและเก็บกิ่ง', reason: '   ' }),
      /requires a reason/,
      'worker updates require a reason',
    );
    await updateLaborWorker(db, somchai, { specialty: 'ตัดหญ้าและเก็บกิ่ง', reason: 'เพิ่มความถนัดล่าสุด' }, '2026-07-30T02:30:00.000Z');
    const workerTimeline = await listLaborTimeline(db, somchai);
    const workerUpdateEvent = workerTimeline.find((event) => event.action === 'worker_updated');
    assert.ok(workerUpdateEvent, 'worker updates must append an audit event');
    assert.equal((workerUpdateEvent.after as { specialty: string }).specialty, 'ตัดหญ้าและเก็บกิ่ง');
    await archiveLaborWorker(db, malee, 'จบงานรอบนี้', '2026-07-30T03:00:00.000Z');
    const eventsBeforePostArchiveRejections = await count(db, 'timeline_events');
    await assert.rejects(
      createNormalWork(db, { title: 'งานใหม่', workDate: '2026-07-30', participants: [{ personId: malee, dueSatang: 1_000 }] }),
      /worker is unavailable/,
      'archived workers cannot create a new payable',
    );
    await assert.rejects(
      editLaborPayment(db, paymentId, { paymentDate: '2026-07-30', allocations: [{ payableId: somchaiPayable.id, amountSatang: 20_000 }], reason: '   ' }),
      /requires a reason/,
      'money edits require a reason',
    );
    assert.equal(await count(db, 'timeline_events'), eventsBeforePostArchiveRejections, 'a failed edit must not mutate or log a timeline event');

    await editLaborPayment(db, paymentId, {
      paymentDate: '2026-07-30', method: 'transfer', note: 'แก้ยอดตามเงินจริง', reason: 'นับธนบัตรใหม่',
      allocations: [{ payableId: somchaiPayable.id, amountSatang: 25_000 }],
    }, '2026-07-30T04:00:00.000Z');
    assert.equal((await listLaborPayables(db, somchai))[0]?.remainingSatang, 25_000, 'edited payment must update the current projection');
    const paymentTimeline = await listLaborTimeline(db, paymentId);
    assert.deepEqual(paymentTimeline.map((event) => event.action), ['payment_posted', 'payment_edited'], 'payment history must append, not replace');
    assert.equal(paymentTimeline[1]?.reason, 'นับธนบัตรใหม่');
    assert.equal((paymentTimeline[1]?.before as { totalSatang: number }).totalSatang, 20_000, 'edit event must preserve the before snapshot');
    assert.equal((paymentTimeline[1]?.after as { totalSatang: number }).totalSatang, 25_000, 'edit event must preserve the after snapshot');
    await assert.rejects(db.runAsync("UPDATE timeline_events SET action = 'tampered' WHERE id = ?", [paymentTimeline[0]?.id]), /immutable/, 'timeline rows must be immutable in SQLite');
    await assert.rejects(db.runAsync('DELETE FROM timeline_events WHERE id = ?', [paymentTimeline[0]?.id]), /immutable/, 'timeline rows must not be deleted in SQLite');

    const firstRead = await getLaborMvpReadModel(db);
    firstConnection.close();
    firstConnection = null;
    secondConnection = new DatabaseSync(databasePath);
    const reopened = new NodeSqliteExecutor(secondConnection);
    const secondRead = await getLaborMvpReadModel(reopened);
    assert.deepEqual(secondRead, firstRead, 'close/reopen must retain the exact Labor MVP read model');
    assert.equal(await count(reopened, 'activities'), legacyCounts.activities, 'normal-work commands must not write legacy activity rows');
    assert.equal(await count(reopened, 'labor_entries'), legacyCounts.laborEntries, 'normal-work commands must not write legacy labor rows');
    console.log('LABOR_MVP_PHASE1_CONTRACT_PASS: additive schema-8 upgrade, no-plot balances, partial payment, reasoned edit audit, atomic rejection, and persistence are valid');
  } finally {
    secondConnection?.close();
    firstConnection?.close();
    await rm(directory, { recursive: true, force: true });
  }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
