import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import { planLaborCompensationV2 } from '../src/features/labor-mvp/compensationV2';

class NodeSqliteExecutor implements SqlExecutor {
  constructor(private readonly database: DatabaseSync) {}
  async execAsync(sql: string): Promise<void> { this.database.exec(sql); }
  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> { return this.database.prepare(sql).all(...(params as SQLInputValue[])) as T[]; }
  async runAsync(sql: string, params: unknown[] = []): Promise<void> { this.database.prepare(sql).run(...(params as SQLInputValue[])); }
}

const tasks = [
  { id: 'shade', workDate: '2026-08-21', title: 'ขึงสแลน', assigneePersonIds: ['su'] },
  { id: 'fertilize', workDate: '2026-08-21', title: 'ใส่ปุ๋ย', assigneePersonIds: ['su'] },
  { id: 'spray', workDate: '2026-08-21', title: 'พ่นยา', assigneePersonIds: ['su'] },
  { id: 'hourly-a', workDate: '2026-08-22', title: 'เก็บกิ่ง', assigneePersonIds: ['su'] },
  { id: 'hourly-b', workDate: '2026-08-22', title: 'ขนของ', assigneePersonIds: ['su'] },
  { id: 'hourly-c', workDate: '2026-08-22', title: 'ล้างอุปกรณ์', assigneePersonIds: ['su'] },
];

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-compensation-v2-'));
  const databasePath = join(directory, 'takai.db');
  let connection: DatabaseSync | null = null;
  try {
    connection = new DatabaseSync(databasePath);
    const db = new NodeSqliteExecutor(connection);
    assert.deepEqual(await runMigrations(db), Array.from({ length: 20 }, (_, index) => index + 1), 'fresh database must include additive V2 foundation, plot, and chemical migrations');
    const v2Tables = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'labor_v2_%' ORDER BY name");
    assert.deepEqual(v2Tables.map((table) => table.name), ['labor_v2_chemical_items', 'labor_v2_chemical_revisions', 'labor_v2_contract_batch_members', 'labor_v2_contract_batch_task_links', 'labor_v2_contract_batches', 'labor_v2_contract_progress', 'labor_v2_daily_unit_task_links', 'labor_v2_daily_units', 'labor_v2_event_history', 'labor_v2_hourly_shifts', 'labor_v2_hourly_time_entries', 'labor_v2_obligations', 'labor_v2_payment_advance_recoveries', 'labor_v2_payment_allocations', 'labor_v2_payment_recipient_settlements', 'labor_v2_payment_revisions', 'labor_v2_payment_sessions', 'labor_v2_plot_revisions', 'labor_v2_plots', 'labor_v2_task_assignments', 'labor_v2_task_plot_targets', 'labor_v2_task_plot_tree_refs', 'labor_v2_work_tasks'], 'V2 must own distinct work, unit, contract, obligation, payment, history, plot-context, and chemical-library tables');
    assert.equal((await db.getAllAsync<{ count: number }>('SELECT count(*) AS count FROM labor_payables'))[0]!.count, 0, 'creating the V2 schema must not make a v1 payable');
    const paymentColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(labor_v2_payment_sessions)');
    assert.ok(paymentColumns.some((column) => column.name === 'method'), 'V2 payment sessions retain their payment method in the additive follow-up migration');
    const settlementSql = (await db.getAllAsync<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'labor_v2_payment_recipient_settlements'"))[0]!.sql;
    const recoverySql = (await db.getAllAsync<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'labor_v2_payment_advance_recoveries'"))[0]!.sql;
    assert.match(settlementSql, /recipient_kind = 'person'.*person_id IS NOT NULL/s, 'V2 settlement shape must make a person recipient explicit');
    assert.match(settlementSql, /bonus_satang/, 'V2 settlement shape must preserve optional bonus facts');
    assert.match(recoverySql, /labor_worker_advance_id.*labor_v2_obligations/s, 'V2 recovery rows must link both the existing person advance and a V2 obligation');

    const dailyAndOpenContract = planLaborCompensationV2({ tasks, daily: [{ id: 'su-2026-08-21', personId: 'su', workDate: '2026-08-21', rateSatang: 35_000, quantityMilli: 1000, taskIds: ['shade', 'fertilize', 'spray'] }], hourly: [], contracts: [{ id: 'bags-open', title: 'กรอกถุงเพาะชำ', startsOn: '2026-08-21', memberPersonIds: ['su', 'phuang'] }] });
    assert.deepEqual(dailyAndOpenContract.dailyUnits.map((unit) => [unit.personId, unit.workDate, unit.taskIds, unit.dueSatang]), [['su', '2026-08-21', ['shade', 'fertilize', 'spray'], 35_000]], 'three daily tasks for one worker/date must plan one daily unit and one 350-baht obligation');
    assert.deepEqual(dailyAndOpenContract.obligations.map((item) => [item.sourceKind, item.recipientKind, item.personId, item.dueSatang]), [['daily', 'person', 'su', 35_000]], 'open contract batches must not create an obligation');
    assert.deepEqual(dailyAndOpenContract.contractBatches.map((batch) => [batch.memberPersonIds, batch.status, batch.dueSatang]), [[['su', 'phuang'], 'open', null]], 'daily and a two-person open contract coexist without merging money');

    const hourly = planLaborCompensationV2({ tasks, daily: [], contracts: [], hourly: [
      { id: 'hour-1', taskId: 'hourly-a', personId: 'su', workDate: '2026-08-22', rateSatang: 12_000, durationMinutes: 60 },
      { id: 'hour-2', taskId: 'hourly-b', personId: 'su', workDate: '2026-08-22', rateSatang: 12_000, durationMinutes: 90 },
      { id: 'hour-3', taskId: 'hourly-c', personId: 'su', workDate: '2026-08-22', rateSatang: 15_000, durationMinutes: 60 },
    ] });
    assert.deepEqual(hourly.hourlyShifts.map((shift) => [shift.rateSatang, shift.durationMinutes, shift.totalSatang, shift.taskTimeEntryIds]), [[12_000, 150, 30_000, ['hour-1', 'hour-2']], [15_000, 60, 15_000, ['hour-3']]], 'same worker/date/rate aggregates task time, while a rate change becomes a distinct shift');

    const finalContracts = planLaborCompensationV2({ tasks, daily: [], hourly: [], contracts: [
      { id: 'solo-batch', title: 'ทำรั้ว', startsOn: '2026-08-21', memberPersonIds: ['su'], finalization: { kind: 'lump_total', finalTotalSatang: 80_000 } },
      { id: 'team-batch', title: 'กรอกถุง', startsOn: '2026-08-21', memberPersonIds: ['su', 'phuang'], finalization: { kind: 'quantity_rate', quantityMilli: 4_125_000, rateSatang: 100, unitLabel: 'ถุง' } },
    ] });
    assert.deepEqual(finalContracts.contractBatches.map((batch) => [batch.id, batch.memberPersonIds.length, batch.status, batch.dueSatang]), [['solo-batch', 1, 'finalized', 80_000], ['team-batch', 2, 'finalized', 412_500]], 'one-person work remains a contract batch and finalization retains one lump per batch');
    assert.deepEqual(finalContracts.obligations.map((item) => [item.sourceUnitId, item.recipientKind, item.personId, item.dueSatang]), [['solo-batch', 'group', null, 80_000], ['team-batch', 'group', null, 412_500]], 'contract obligations never invent member shares');

    assert.throws(() => planLaborCompensationV2({ tasks, hourly: [], contracts: [], daily: [{ id: 'half-a', personId: 'su', workDate: '2026-08-21', rateSatang: 35_000, quantityMilli: 500, taskIds: ['shade'] }, { id: 'half-b', personId: 'su', workDate: '2026-08-21', rateSatang: 35_000, quantityMilli: 1000, taskIds: ['fertilize'] }] }), /cannot exceed one full day/, 'daily quantities beyond one day must fail before a write');
    assert.throws(() => planLaborCompensationV2({ tasks, daily: [], contracts: [], hourly: [{ id: 'bad-hour', taskId: 'hourly-a', personId: 'su', workDate: '2026-08-22', rateSatang: 1_000, durationMinutes: 1 }] }), /whole satang/, 'fractional-satang hourly calculations must fail');
    assert.throws(() => planLaborCompensationV2({ tasks, daily: [], hourly: [], contracts: [{ id: 'no-members', title: 'ผิด', startsOn: '2026-08-21', memberPersonIds: [] }] }), /contract members/, 'a contract batch must always name one or more members');
    console.log('LABOR_COMPENSATION_V2_PASS: additive V2 schema, daily aggregation, open/finalized contract batches, hourly shift splits, and invariant failures are valid');
  } finally { connection?.close(); await rm(directory, { recursive: true, force: true }); }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
