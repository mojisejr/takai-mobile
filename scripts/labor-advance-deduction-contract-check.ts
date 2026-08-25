import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import {
  applyLaborAdvanceDeduction,
  createGroupPieceWork,
  createLaborWorker,
  createLaborWorkerAdvance,
  createNormalWork,
  editLaborWorkerAdvance,
  getLaborMvpReadModel,
  listLaborAdvanceDeductions,
  listLaborPayables,
  listLaborTimeline,
  postLaborPayment,
} from '../src/features/labor-mvp';

class NodeSqliteExecutor implements SqlExecutor {
  constructor(private readonly database: DatabaseSync) {}
  async execAsync(sql: string): Promise<void> { this.database.exec(sql); }
  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> { return this.database.prepare(sql).all(...(params as SQLInputValue[])) as T[]; }
  async runAsync(sql: string, params: unknown[] = []): Promise<void> { this.database.prepare(sql).run(...(params as SQLInputValue[])); }
}

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-labor-advance-'));
  const databasePath = join(directory, 'takai.db');
  let firstConnection: DatabaseSync | null = null;
  let secondConnection: DatabaseSync | null = null;
  try {
    firstConnection = new DatabaseSync(databasePath);
    const db = new NodeSqliteExecutor(firstConnection);
    assert.deepEqual(await runMigrations(db), Array.from({ length: 20 }, (_, index) => index + 1), 'fresh schema must include additive advance-recovery, payment-session, plot, and chemical ledgers');
    const kai = await createLaborWorker(db, { id: 'worker-kai', displayName: 'น้าไก่' }, '2026-08-02T01:00:00.000Z');
    const su = await createLaborWorker(db, { id: 'worker-su', displayName: 'พี่สุ' }, '2026-08-02T01:00:01.000Z');
    const advance = await createLaborWorkerAdvance(db, {
      id: 'kai-advance', personId: kai, advanceDate: '2026-08-02', amountSatang: 100_000, method: 'cash', note: 'เบิกล่วงหน้า',
    }, '2026-08-02T02:00:00.000Z');

    const payableIds: string[] = [];
    for (const day of [3, 4, 5]) {
      const work = await createNormalWork(db, {
        id: `kai-day-${day}`, title: 'เก็บกิ่งรายวัน', workDate: `2026-08-0${day}`,
        participants: [{ personId: kai, dueSatang: 35_000, payType: 'daily' }],
      }, `2026-08-0${day}T01:00:00.000Z`);
      payableIds.push(work.payableIds[0]!);
      await applyLaborAdvanceDeduction(db, {
        id: `kai-recovery-${day}`, advanceId: advance, payableId: work.payableIds[0]!, recoveryDate: `2026-08-0${day}`, amountSatang: 5_000, note: 'หักคืนเงินเบิก',
      }, `2026-08-0${day}T02:00:00.000Z`);
      await postLaborPayment(db, {
        id: `kai-cash-${day}`, personId: kai, paymentDate: `2026-08-0${day}`, method: 'cash',
        allocations: [{ payableId: work.payableIds[0]!, amountSatang: 30_000 }],
      }, `2026-08-0${day}T03:00:00.000Z`);
    }

    const kaiPayables = await listLaborPayables(db, kai);
    assert.deepEqual(kaiPayables.map((payable) => [payable.dueSatang, payable.paidSatang, payable.recoveredSatang, payable.remainingSatang]).sort(), [
      [35_000, 30_000, 5_000, 0], [35_000, 30_000, 5_000, 0], [35_000, 30_000, 5_000, 0],
    ], 'each recovery must settle only its selected individual wage payable, leaving the cash amount explicit');
    const read = await getLaborMvpReadModel(db);
    const kaiAccount = read.people.find((person) => person.id === kai)!;
    assert.deepEqual([
      kaiAccount.grossEarnedSatang, kaiAccount.cashPaidSatang, kaiAccount.wageRemainingSatang,
      kaiAccount.advanceIssuedSatang, kaiAccount.advanceRecoveredSatang, kaiAccount.advanceRemainingSatang,
    ], [105_000, 90_000, 0, 100_000, 15_000, 85_000], 'Kai must retain separate wage and advance balances exactly');
    assert.deepEqual(read.advanceDeductions.map((deduction) => deduction.amountSatang), [5_000, 5_000, 5_000], 'recovery evidence must stay append-only and exact');

    const suWork = await createNormalWork(db, {
      id: 'su-day', title: 'งานพี่สุ', workDate: '2026-08-06', participants: [{ personId: su, dueSatang: 35_000 }],
    }, '2026-08-06T01:00:00.000Z');
    await assert.rejects(
      applyLaborAdvanceDeduction(db, { advanceId: advance, payableId: suWork.payableIds[0]!, recoveryDate: '2026-08-06', amountSatang: 1_000 }),
      /same worker/,
      'an advance cannot recover from a different worker wage',
    );
    await assert.rejects(
      applyLaborAdvanceDeduction(db, { advanceId: advance, payableId: suWork.payableIds[0]!, recoveryDate: '2026-08-06', amountSatang: -1 }),
      /positive INTEGER/,
      'negative recovery is forbidden before any ledger write',
    );
    await assert.rejects(
      editLaborWorkerAdvance(db, advance, { advanceDate: '2026-08-02', amountSatang: 100_000, reason: ' ' }),
      /requires a reason/,
      'advance corrections require a recorded reason',
    );
    await assert.rejects(
      editLaborWorkerAdvance(db, advance, { advanceDate: '2026-08-02', amountSatang: 14_999, reason: 'ลดผิด' }),
      /below recovered amount/,
      'an advance correction cannot make its recovery balance negative',
    );
    await editLaborWorkerAdvance(db, advance, {
      advanceDate: '2026-08-02', amountSatang: 100_000, method: 'cash', note: 'ตรวจสมุดใหม่', reason: 'ยืนยันยอดเงินเบิก',
    }, '2026-08-06T02:00:00.000Z');

    const kaiOverRecoveryWork = await createNormalWork(db, {
      id: 'kai-over-recovery-work', title: 'งานทดสอบยอดหัก', workDate: '2026-08-07', participants: [{ personId: kai, dueSatang: 2_000 }],
    }, '2026-08-07T00:30:00.000Z');
    const tinyAdvance = await createLaborWorkerAdvance(db, {
      id: 'kai-tiny-advance', personId: kai, advanceDate: '2026-08-07', amountSatang: 1_000,
    }, '2026-08-07T00:31:00.000Z');
    await assert.rejects(
      applyLaborAdvanceDeduction(db, { advanceId: tinyAdvance, payableId: kaiOverRecoveryWork.payableIds[0]!, recoveryDate: '2026-08-07', amountSatang: 1_001 }),
      /cannot exceed advance remaining balance/,
      'a recovery cannot exceed the same worker advance remaining balance',
    );

    const group = await createGroupPieceWork(db, {
      id: 'group-work', settlementGroupId: 'group-settlement', title: 'กรอกถุงเป็นชุด', workDate: '2026-08-07',
      memberPersonIds: [kai, su], quantityMilli: 1_000, rateSatang: 100, unitLabel: 'ถุง',
    }, '2026-08-07T01:00:00.000Z');
    await assert.rejects(
      applyLaborAdvanceDeduction(db, { advanceId: advance, payableId: group.settlementGroupId, recoveryDate: '2026-08-07', amountSatang: 1 }),
      /payable is unavailable/,
      'a group settlement has no individual payable and cannot recover a member advance',
    );
    assert.equal((await listLaborAdvanceDeductions(db, kai)).length, 3, 'failed recovery attempts must not mutate the ledger');
    assert.deepEqual((await listLaborTimeline(db, kai)).map((event) => event.action), [
      'worker_created', 'worker_advance_issued', 'worker_advance_recovered_from_wage', 'worker_advance_recovered_from_wage', 'worker_advance_recovered_from_wage', 'worker_advance_corrected', 'worker_advance_issued',
    ], 'person timeline must retain issue, reasoned correction, and every wage recovery');

    const firstRead = await getLaborMvpReadModel(db);
    firstConnection.close();
    firstConnection = null;
    secondConnection = new DatabaseSync(databasePath);
    assert.deepEqual(await getLaborMvpReadModel(new NodeSqliteExecutor(secondConnection)), firstRead, 'advance and recovery projections must survive close/reopen');
    console.log('LABOR_ADVANCE_DEDUCTION_CONTRACT_PASS: person-only advances, exact wage recoveries, separate balances, correction history, and group isolation are valid');
  } finally {
    secondConnection?.close();
    firstConnection?.close();
    await rm(directory, { recursive: true, force: true });
  }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
