import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import {
  addLaborContractProgress,
  createLaborContract,
  createLaborWorker,
  createManualOpeningBalance,
  getLaborMvpReadModel,
  importLegacyLaborEntries,
  listLaborContracts,
  listLegacyCarryForwardBalances,
  listLegacyLaborSources,
  listLaborPayables,
  listLaborTimeline,
  postLaborPayment,
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

const count = async (db: NodeSqliteExecutor, table: string): Promise<number> => Number((await db.getAllAsync<{ count: number }>(`SELECT count(*) AS count FROM ${table}`))[0]?.count ?? 0);

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-labor-mvp-phase2-'));
  const databasePath = join(directory, 'takai.db');
  let firstConnection: DatabaseSync | null = null;
  let secondConnection: DatabaseSync | null = null;
  try {
    firstConnection = new DatabaseSync(databasePath);
    const db = new NodeSqliteExecutor(firstConnection);
    await runMigrations(db);
    await db.runAsync("INSERT INTO gardens (id, name, created_at) VALUES ('legacy-garden', 'สวนเดิม', '2024-01-01')");
    await db.runAsync("INSERT INTO plots (id, garden_id, name) VALUES ('legacy-plot', 'legacy-garden', 'แปลงเดิม')");
    await db.runAsync("INSERT INTO activity_categories (id, name, kind) VALUES ('legacy-category', 'งานเดิม', 'labor')");
    await db.runAsync("INSERT INTO activities (id, plot_id, category_id, performed_at, note, status) VALUES ('legacy-activity', 'legacy-plot', 'legacy-category', '2025-01-02T00:00:00.000Z', 'งานเดิม', 'done')");
    await db.runAsync("INSERT INTO people (id, display_name, role, is_self, specialty, phone, note) VALUES ('legacy-owner', 'เจ้าของ', 'owner', 1, '', '', '')");
    const a = await createLaborWorker(db, { id: 'worker-a', displayName: 'สมชาย' }, '2026-07-31T00:00:00.000Z');
    const b = await createLaborWorker(db, { id: 'worker-b', displayName: 'มาลี' }, '2026-07-31T00:00:01.000Z');
    await db.runAsync("INSERT INTO activity_participants (id, activity_id, person_id, pay_type, amount_due) VALUES ('legacy-participant', 'legacy-activity', ?, 'daily', 900.5)", [a]);
    await db.runAsync("INSERT INTO labor_entries (id, activity_participant_id, person_id, work_date, amount_due, amount_paid, status) VALUES ('legacy-entry', 'legacy-participant', ?, '2025-01-02', 900.5, 100.25, 'unpaid')", [a]);
    const legacyBefore = await db.getAllAsync<{ id: string; amount_due: number; amount_paid: number; status: string }>('SELECT id, amount_due, amount_paid, status FROM labor_entries WHERE id = ?', ['legacy-entry']);

    const contractId = await createLaborContract(db, {
      id: 'contract-fence', title: 'งานเหมาทำรั้ว', workDate: '2026-07-31', startsOn: '2026-07-31', deadlineOn: '2026-08-05',
      participants: [{ personId: a }, { personId: b }],
    }, '2026-07-31T01:00:00.000Z');
    await addLaborContractProgress(db, contractId, { id: 'progress-1', progressDate: '2026-08-01', note: 'เริ่มตอกเสาแล้ว' }, '2026-08-01T01:00:00.000Z');
    assert.equal((await listLaborContracts(db))[0]?.totalSatang, null, 'new contract must begin without an inferred total or shares');
    const eventsBeforeInvalidReconcile = await count(db, 'timeline_events');
    await assert.rejects(
      reconcileLaborContractShares(db, contractId, { totalSatang: 100_000, shares: [{ personId: a, amountSatang: 60_000 }, { personId: b, amountSatang: 30_000 }] }),
      /equal the contract total/,
      'mismatched shares must not create a contract payable',
    );
    await assert.rejects(
      createLaborContract(db, { title: 'งานเหมาผิด', workDate: '2026-07-31', participants: [{ personId: 'legacy-owner' }] }),
      /worker is unavailable/,
      'self or non-worker cannot become a contract payee',
    );
    assert.equal(await count(db, 'timeline_events'), eventsBeforeInvalidReconcile, 'invalid contract commands must be atomic and emit no event');

    const contractPayables = await reconcileLaborContractShares(db, contractId, {
      totalSatang: 100_000,
      shares: [{ personId: a, amountSatang: 60_000, payableId: 'contract-payable-a' }, { personId: b, amountSatang: 40_000, payableId: 'contract-payable-b' }],
    }, '2026-08-01T02:00:00.000Z');
    assert.deepEqual(contractPayables, ['contract-payable-a', 'contract-payable-b']);
    const reconciled = (await listLaborContracts(db)).find((contract) => contract.id === contractId)!;
    assert.equal(reconciled.isReconciled, true, 'explicit shares must reconcile exactly before settlement');
    assert.deepEqual(reconciled.progress.map((item) => item.id), ['progress-1'], 'contract progress must be retained in the contract read model');

    await postLaborPayment(db, { id: 'contract-payment-a', personId: a, paymentDate: '2026-08-02', allocations: [{ payableId: 'contract-payable-a', amountSatang: 25_000 }] }, '2026-08-02T01:00:00.000Z');
    const contractAfterPartial = (await listLaborContracts(db)).find((contract) => contract.id === contractId)!;
    assert.deepEqual(contractAfterPartial.participants.map((participant) => [participant.personId, participant.shareSatang, participant.paidSatang, participant.remainingSatang]).sort(), [
      [a, 60_000, 25_000, 35_000], [b, 40_000, 0, 40_000],
    ], 'a partial contract payment must only change the selected worker balance');
    const eventsBeforeLockedChange = await count(db, 'timeline_events');
    await assert.rejects(
      reconcileLaborContractShares(db, contractId, { totalSatang: 100_000, shares: [{ personId: a, amountSatang: 50_000 }, { personId: b, amountSatang: 50_000 }], reason: 'ลองแก้หลังจ่าย' }),
      /cannot change after payment/,
      'contract shares must lock once payment has posted',
    );
    assert.equal(await count(db, 'timeline_events'), eventsBeforeLockedChange, 'a locked reconciliation must not mutate or emit an event');
    assert.deepEqual((await listLaborTimeline(db, contractId)).map((event) => event.action), ['contract_created', 'contract_progress_added', 'contract_shares_reconciled'], 'contract creation, progress, and reconciliation require timeline history');

    const availableSources = await listLegacyLaborSources(db, false);
    assert.deepEqual(availableSources.map((source) => [source.legacyLaborEntryId, source.remainingSatang]), [['legacy-entry', 80_025]], 'legacy source must snapshot remaining baht as safe satang');
    const imported = await importLegacyLaborEntries(db, { id: 'legacy-batch-1', legacyLaborEntryIds: ['legacy-entry'], note: 'ค้างจากระบบเก่า' }, '2026-08-03T01:00:00.000Z');
    assert.equal(imported.payableIds.length, 1);
    assert.deepEqual(await db.getAllAsync<{ id: string; amount_due: number; amount_paid: number; status: string }>('SELECT id, amount_due, amount_paid, status FROM labor_entries WHERE id = ?', ['legacy-entry']), legacyBefore, 'legacy source must remain byte-for-byte unchanged after import');
    await postLaborPayment(db, { personId: a, paymentDate: '2026-08-03', allocations: [{ payableId: imported.payableIds[0]!, amountSatang: 20_000 }] }, '2026-08-03T02:00:00.000Z');
    const importedBalance = (await listLegacyCarryForwardBalances(db)).find((balance) => balance.sourceLaborEntryId === 'legacy-entry')!;
    assert.deepEqual([importedBalance.sourceDueSatang, importedBalance.paidSatang, importedBalance.remainingSatang, importedBalance.isManual], [80_025, 20_000, 60_025, false], 'imported legacy balance must retain source identity through partial payment');
    const eventsBeforeDuplicate = await count(db, 'timeline_events');
    await assert.rejects(importLegacyLaborEntries(db, { legacyLaborEntryIds: ['legacy-entry'] }), /already imported/, 'legacy source may only import once');
    assert.equal(await count(db, 'timeline_events'), eventsBeforeDuplicate, 'duplicate legacy import must have no domain event');

    const manualPayableId = await createManualOpeningBalance(db, { id: 'manual-opening-1', personId: b, workDate: '2026-08-03', dueSatang: 15_000, note: 'ยอดค้างที่จดในสมุด' }, '2026-08-03T03:00:00.000Z');
    const manualBalance = (await listLegacyCarryForwardBalances(db)).find((balance) => balance.id === manualPayableId)!;
    assert.equal(manualBalance.isManual, true, 'manual opening balance must be distinct from a linked legacy source');
    assert.equal(manualBalance.sourceLaborEntryId, null);

    const firstRead = await getLaborMvpReadModel(db);
    firstConnection.close();
    firstConnection = null;
    secondConnection = new DatabaseSync(databasePath);
    const reopened = new NodeSqliteExecutor(secondConnection);
    assert.deepEqual(await getLaborMvpReadModel(reopened), firstRead, 'contract, carry-forward, timeline, and balances must survive close/reopen');
    assert.equal((await listLaborPayables(reopened)).some((payable) => payable.jobId === contractId && payable.kind !== 'contract'), false, 'contract payables must remain isolated in the new ledger');
    console.log('LABOR_MVP_PHASE2_CONTRACT_PASS: unknown-total contracts, explicit multi-payee reconciliation, independent partial settlement, and source-preserving carry-forward are valid');
  } finally {
    secondConnection?.close();
    firstConnection?.close();
    await rm(directory, { recursive: true, force: true });
  }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
