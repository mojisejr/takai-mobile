import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import { TAKAI_MIGRATIONS } from '../src/data/schema';
import {
  createLaborContract,
  createLaborSettlementGroup,
  createLaborWorker,
  createNormalWork,
  editLaborSettlementGroupReceipt,
  getLaborMvpReadModel,
  listLaborPayables,
  listLaborSettlementGroups,
  listLaborTimeline,
  postLaborSettlementGroupReceipt,
  reconcileLaborContractShares,
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

const applyThroughEleven = async (db: NodeSqliteExecutor): Promise<void> => {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.execAsync('CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
  for (const migration of TAKAI_MIGRATIONS.filter((item) => item.id <= 11)) {
    for (const statement of migration.statements) await db.execAsync(statement);
    await db.runAsync('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)', [migration.id, migration.name, '2026-07-31T00:00:00.000Z']);
  }
};

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-settlement-group-'));
  const databasePath = join(directory, 'takai.db');
  let firstConnection: DatabaseSync | null = null;
  let secondConnection: DatabaseSync | null = null;
  try {
    firstConnection = new DatabaseSync(databasePath);
    const db = new NodeSqliteExecutor(firstConnection);
    await applyThroughEleven(db);
    assert.deepEqual(await runMigrations(db), [12, 13, 14], 'schema-11 upgrade must apply only additive settlement-group, work-basis, and hourly-duration migrations');

    const su = await createLaborWorker(db, { id: 'worker-su', displayName: 'สุ' }, '2026-07-31T01:00:00.000Z');
    const phuang = await createLaborWorker(db, { id: 'worker-phuang', displayName: 'พ่วง' }, '2026-07-31T01:00:01.000Z');
    const groupJobId = await createLaborContract(db, {
      id: 'group-bags-job', title: 'เก็บผลผลิตรวมทีม', workDate: '2026-07-31', participants: [{ personId: su }, { personId: phuang }],
    }, '2026-07-31T02:00:00.000Z');

    await assert.rejects(
      createLaborSettlementGroup(db, { laborJobId: groupJobId, originalDueSatang: 412_500, memberPersonIds: [su, su] }),
      /distinct worker members/,
      'a settlement group cannot overlap the same member twice',
    );
    const groupId = await createLaborSettlementGroup(db, {
      id: 'group-su-phuang', laborJobId: groupJobId, originalDueSatang: 412_500, memberPersonIds: [su, phuang], collectorPersonId: su,
    }, '2026-07-31T02:01:00.000Z');
    const groupBeforeReceipts = (await listLaborSettlementGroups(db, groupJobId))[0]!;
    assert.deepEqual([groupBeforeReceipts.originalDueSatang, groupBeforeReceipts.paidSatang, groupBeforeReceipts.remainingSatang, groupBeforeReceipts.memberPersonIds], [412_500, 0, 412_500, [su, phuang]], 'two workers must own one exact group due without inferred shares');
    assert.equal((await listLaborPayables(db)).filter((payable) => payable.jobId === groupJobId).length, 0, 'group settlement must create zero individual payables');

    const firstReceipt = await postLaborSettlementGroupReceipt(db, {
      id: 'group-receipt-1', settlementGroupId: groupId, receiptDate: '2026-08-01', amountSatang: 100_000, method: 'cash',
    }, '2026-08-01T01:00:00.000Z');
    assert.equal(firstReceipt, 'group-receipt-1');
    assert.deepEqual((await listLaborSettlementGroups(db, groupJobId))[0]!.remainingSatang, 312_500, 'partial group receipt must retain exact remaining balance');
    await assert.rejects(
      createLaborSettlementGroup(db, { laborJobId: groupJobId, originalDueSatang: 412_500, memberPersonIds: [su, phuang] }),
      /already has a settlement group/,
      'a job cannot create a second settlement route after receipt',
    );
    await assert.rejects(
      reconcileLaborContractShares(db, groupJobId, { totalSatang: 412_500, shares: [{ personId: su, amountSatang: 206_250 }, { personId: phuang, amountSatang: 206_250 }] }),
      /cannot mix individual shares with a settlement group/,
      'individual payables cannot be created after a group receipt',
    );
    await assert.rejects(
      postLaborSettlementGroupReceipt(db, { settlementGroupId: groupId, receiptDate: '2026-08-01', amountSatang: 312_501 }),
      /cannot exceed remaining balance/,
      'group receipt cannot overpay the original due',
    );
    await assert.rejects(
      editLaborSettlementGroupReceipt(db, firstReceipt, { receiptDate: '2026-08-01', amountSatang: 100_000, reason: ' ' }),
      /requires a reason/,
      'group receipt edits require a reason',
    );
    await editLaborSettlementGroupReceipt(db, firstReceipt, {
      receiptDate: '2026-08-01', amountSatang: 112_500, method: 'cash', note: 'นับใหม่', reason: 'แก้ยอดรับเงินจริง',
    }, '2026-08-01T02:00:00.000Z');
    assert.equal((await listLaborSettlementGroups(db, groupJobId))[0]!.remainingSatang, 300_000, 'reasoned receipt revision must update the remaining projection exactly');
    await postLaborSettlementGroupReceipt(db, {
      id: 'group-receipt-2', settlementGroupId: groupId, receiptDate: '2026-08-02', amountSatang: 300_000, method: 'transfer',
    }, '2026-08-02T01:00:00.000Z');
    const settledGroup = (await listLaborSettlementGroups(db, groupJobId))[0]!;
    assert.deepEqual([settledGroup.paidSatang, settledGroup.remainingSatang, settledGroup.status, settledGroup.receipts.map((receipt) => receipt.currentRevision)], [412_500, 0, 'settled', [2, 1]], 'partial and final receipts must settle one group balance without person debts');
    assert.deepEqual((await listLaborTimeline(db, groupJobId)).map((event) => event.action), [
      'contract_created', 'settlement_group_created', 'settlement_group_receipt_posted', 'settlement_group_receipt_edited', 'settlement_group_receipt_posted',
    ], 'labor-job timeline must retain immutable group and receipt snapshots');

    const individualJob = await createNormalWork(db, {
      id: 'individual-job', title: 'งานรายวันแยกคน', workDate: '2026-08-02', participants: [{ personId: su, dueSatang: 35_000 }],
    }, '2026-08-02T02:00:00.000Z');
    await assert.rejects(
      createLaborSettlementGroup(db, { laborJobId: individualJob.jobId, originalDueSatang: 35_000, memberPersonIds: [su] }),
      /cannot mix with individual payables/,
      'an existing individual route cannot switch to a group route',
    );

    const firstRead = await getLaborMvpReadModel(db);
    firstConnection.close();
    firstConnection = null;
    secondConnection = new DatabaseSync(databasePath);
    const reopened = new NodeSqliteExecutor(secondConnection);
    assert.deepEqual(await getLaborMvpReadModel(reopened), firstRead, 'group receipts and legacy individual read model must survive close/reopen');
    assert.equal((await listLaborPayables(reopened)).filter((payable) => payable.jobId === groupJobId).length, 0, 'reopen must not fabricate individual group member balances');
    console.log('LABOR_SETTLEMENT_GROUP_CONTRACT_PASS: additive group due, partial/final receipts, route isolation, immutable timeline, and reopen truth are valid');
  } finally {
    secondConnection?.close();
    firstConnection?.close();
    await rm(directory, { recursive: true, force: true });
  }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
