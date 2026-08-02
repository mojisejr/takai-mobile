import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import {
  addLaborContractProgress,
  applyLaborAdvanceDeduction,
  completeLaborContractWork,
  createGroupPieceWork,
  createLaborContract,
  createLaborSettlementGroup,
  createLaborWorker,
  createLaborWorkerAdvance,
  createNormalWork,
  getLaborCalendarRange,
  getLaborHistory,
  getLaborJobDetail,
  getLaborPersonDetail,
  getLaborTodaySummary,
  postLaborPayment,
  postLaborSettlementGroupReceipt,
} from '../src/features/labor-mvp';

class NodeSqliteExecutor implements SqlExecutor {
  constructor(private readonly database: DatabaseSync) {}
  async execAsync(sql: string): Promise<void> { this.database.exec(sql); }
  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> { return this.database.prepare(sql).all(...(params as SQLInputValue[])) as T[]; }
  async runAsync(sql: string, params: unknown[] = []): Promise<void> { this.database.prepare(sql).run(...(params as SQLInputValue[])); }
}

const baht = (amount: number): number => amount * 100;

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-labor-read-projections-'));
  let connection: DatabaseSync | null = null;
  try {
    connection = new DatabaseSync(join(directory, 'takai.db'));
    const db = new NodeSqliteExecutor(connection);
    await runMigrations(db);
    const su = await createLaborWorker(db, { id: 'su', displayName: 'พี่สุ' }, '2026-01-10T10:00:00.000Z');
    const phuang = await createLaborWorker(db, { id: 'phuang', displayName: 'พี่พวง' }, '2026-01-10T10:00:01.000Z');
    const kai = await createLaborWorker(db, { id: 'kai', displayName: 'น้าไก่' }, '2026-01-10T10:00:02.000Z');

    const daily = await createNormalWork(db, {
      id: 'late-daily', title: 'ตัดหญ้า', workDate: '2026-01-03',
      participants: [{ personId: su, payType: 'daily', dueSatang: baht(350), rateSatang: baht(350), quantityMilli: 1000, unitLabel: 'วัน' }],
    }, '2026-01-10T12:00:00.000Z');
    await postLaborPayment(db, { id: 'late-daily-payment', personId: su, paymentDate: '2026-01-05', allocations: [{ payableId: daily.payableIds[0]!, amountSatang: baht(350) }] }, '2026-01-10T12:01:00.000Z');

    const hourly = await createNormalWork(db, {
      id: 'same-day-hourly', title: 'ซ่อมปั๊มน้ำ', workDate: '2026-01-03',
      participants: [{ personId: su, payType: 'hourly', dueSatang: baht(100), rateSatang: baht(50), durationMinutes: 120, unitLabel: 'ชั่วโมง' }],
    }, '2026-01-10T12:02:00.000Z');
    const piece = await createNormalWork(db, {
      id: 'same-day-piece', title: 'กรอกถุงเดี่ยว', workDate: '2026-01-03',
      participants: [{ personId: su, payType: 'piece', dueSatang: baht(20), rateSatang: baht(1), quantityMilli: 20_000, unitLabel: 'ถุง' }],
    }, '2026-01-10T12:03:00.000Z');
    assert.ok(hourly.jobId && piece.jobId);

    const group = await createGroupPieceWork(db, {
      id: 'group-piece', settlementGroupId: 'group-piece-settlement', title: 'กรอกถุงชุด', workDate: '2026-01-04',
      memberPersonIds: [su, phuang], quantityMilli: 1_000_000, rateSatang: baht(1), unitLabel: 'ถุง', collectorPersonId: su,
    }, '2026-01-10T12:04:00.000Z');
    await postLaborSettlementGroupReceipt(db, { id: 'group-piece-receipt', settlementGroupId: group.settlementGroupId, receiptDate: '2026-01-06', amountSatang: baht(1000) }, '2026-01-10T12:05:00.000Z');

    const advanceId = await createLaborWorkerAdvance(db, { id: 'kai-advance', personId: kai, advanceDate: '2026-01-02', amountSatang: baht(1000) }, '2026-01-10T12:06:00.000Z');
    const kaiWork = await createNormalWork(db, {
      id: 'kai-work', title: 'เก็บกิ่ง', workDate: '2026-01-07',
      participants: [{ personId: kai, payType: 'daily', dueSatang: baht(350), rateSatang: baht(350), quantityMilli: 1000, unitLabel: 'วัน' }],
    }, '2026-01-10T12:07:00.000Z');
    await applyLaborAdvanceDeduction(db, { id: 'kai-recovery', advanceId, payableId: kaiWork.payableIds[0]!, recoveryDate: '2026-01-07', amountSatang: baht(50) }, '2026-01-10T12:08:00.000Z');

    const contractId = await createLaborContract(db, {
      id: 'contract', title: 'งานเหมารั้ว', workDate: '2026-01-01', startsOn: '2026-01-01', deadlineOn: '2026-01-08', settlementRoute: 'group', participants: [{ personId: su }, { personId: phuang }],
    }, '2026-01-10T12:09:00.000Z');
    await addLaborContractProgress(db, contractId, { id: 'contract-progress', progressDate: '2026-01-04', note: 'ตอกเสาแล้ว' }, '2026-01-10T12:10:00.000Z');
    await completeLaborContractWork(db, contractId, { id: 'contract-complete', completedOn: '2026-01-07', finalTotalSatang: baht(500), rateSatang: baht(1), quantityMilli: 500_000, unitLabel: 'เมตร' }, '2026-01-10T12:11:00.000Z');
    await createLaborSettlementGroup(db, { id: 'contract-settlement', laborJobId: contractId, originalDueSatang: baht(500), memberPersonIds: [su, phuang] }, '2026-01-10T12:12:00.000Z');

    const empty = await getLaborCalendarRange(db, { startDate: '2026-02-01', endDate: '2026-02-02' });
    assert.deepEqual(empty.days.map((day) => [day.date, day.events.length]), [['2026-02-01', 0], ['2026-02-02', 0]], 'empty calendar must preserve typed daily shape');

    const calendar = await getLaborCalendarRange(db, { startDate: '2026-01-01', endDate: '2026-01-08' });
    const jan3 = calendar.days.find((day) => day.date === '2026-01-03')!;
    assert.deepEqual(jan3.events.filter((event) => event.eventType === 'work').map((event) => event.jobId).sort(), ['late-daily', 'same-day-hourly', 'same-day-piece'], 'same worker jobs must remain separate rows on one work date');
    assert.equal(jan3.events.find((event) => event.jobId === 'late-daily')?.recordedAt, '2026-01-10T12:00:00.000Z', 'work date must be separate from late audit record time');
    assert.equal(calendar.days.find((day) => day.date === '2026-01-05')?.individualPaymentSatang, baht(350), 'payment buckets by payment date');
    assert.equal(calendar.days.find((day) => day.date === '2026-01-06')?.groupReceiptSatang, baht(1000), 'group receipt buckets by receipt date');
    assert.equal(calendar.days.find((day) => day.date === '2026-01-07')?.advanceRecoveredSatang, baht(50), 'recovery buckets by recovery date');
    assert.equal(calendar.days.find((day) => day.date === '2026-01-08')?.contractDeadlineCount, 1, 'deadline remains a non-financial contract marker');

    const groupHistory = await getLaborHistory(db, { startDate: '2026-01-06', endDate: '2026-01-06', eventTypes: ['group_receipt'] });
    assert.deepEqual(groupHistory.events.map((event) => [event.personId, event.personIds, event.amountSatang]), [[null, [], baht(1000)]], 'group cash must never become a member personal wage event');
    const suHistory = await getLaborHistory(db, { startDate: '2026-01-01', endDate: '2026-01-08', personId: su });
    assert.equal(suHistory.events.some((event) => event.eventType === 'group_receipt'), false, 'member history must not claim group receipt cash');
    const contractEvents = (await getLaborJobDetail(db, contractId))!.events;
    assert.deepEqual(contractEvents.filter((event) => event.eventType === 'contract_completion').map((event) => [event.amountSatang, event.dueSatang]), [[0, baht(500)]], 'contract completion exposes obligation context without double-counting cash');
    assert.equal((await getLaborPersonDetail(db, kai))?.person.advanceRemainingSatang, baht(950), 'person detail keeps advance balance separate from wage cash');
    assert.deepEqual((await getLaborTodaySummary(db, '2026-01-07')).day.events.map((event) => event.eventType).sort(), ['advance_recovery', 'contract_completion', 'work'], 'today summary uses effective date buckets');
    console.log('LABOR_READ_PROJECTIONS_PASS: effective dates, calendar/history filters, group isolation, contract markers, same-day jobs, and typed empty state verified');
  } finally {
    connection?.close();
    await rm(directory, { recursive: true, force: true });
  }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
