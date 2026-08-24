import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import {
  createLaborWorker,
  createLaborWorkerAdvance,
  correctLaborPaymentSession,
  getLaborCalendarRange,
  getLaborMvpReadModel,
  listLaborPayables,
  listLaborSettlementGroups,
  postLaborPaymentSession,
  recordLaborWorkItems,
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

const fixed = (value: string): string => value;

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-payment-session-'));
  const databasePath = join(directory, 'takai.db');
  let connection: DatabaseSync | null = null;
  try {
    connection = new DatabaseSync(databasePath);
    const db = new NodeSqliteExecutor(connection);
    assert.deepEqual(await runMigrations(db), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    const su = await createLaborWorker(db, { id: 'su', displayName: 'สุ' }, fixed('2026-08-20T00:00:00.000Z'));
    const phuang = await createLaborWorker(db, { id: 'phuang', displayName: 'พ่วง' }, fixed('2026-08-20T00:00:00.000Z'));
    const chon = await createLaborWorker(db, { id: 'chon', displayName: 'ชล' }, fixed('2026-08-20T00:00:00.000Z'));

    await recordLaborWorkItems(db, {
      workDate: '2026-08-20',
      items: [
        { settlementRoute: 'individual', id: 'su-morning', title: 'ตัดหญ้า', participants: [{ personId: su, dueSatang: 35_000 }] },
        { settlementRoute: 'individual', id: 'phuang-hourly', title: 'เก็บผลไม้', participants: [{ personId: phuang, payType: 'hourly', rateSatang: 12_000, durationMinutes: 300, dueSatang: 60_000 }] },
        { settlementRoute: 'individual', id: 'chon-half', title: 'รดน้ำ', participants: [{ personId: chon, dueSatang: 17_500 }] },
      ],
    }, fixed('2026-08-20T01:00:00.000Z'));
    const firstPayables = new Map((await listLaborPayables(db)).map((payable) => [payable.jobId, payable]));
    const multiSession = await postLaborPaymentSession(db, {
      id: 'multi-person-cash', paymentDate: '2026-08-20', method: 'cash', note: 'จ่ายสามคนจากงานที่เลือก',
      settlements: [
        { recipientType: 'person', personId: su, wageAllocations: [{ payableId: firstPayables.get('su-morning')!.id, amountSatang: 35_000 }] },
        { recipientType: 'person', personId: phuang, wageAllocations: [{ payableId: firstPayables.get('phuang-hourly')!.id, amountSatang: 60_000 }] },
        { recipientType: 'person', personId: chon, wageAllocations: [{ payableId: firstPayables.get('chon-half')!.id, amountSatang: 17_500 }] },
      ],
    }, fixed('2026-08-20T02:00:00.000Z'));
    assert.equal(multiSession, 'multi-person-cash');
    const multiRead = await getLaborMvpReadModel(db);
    assert.deepEqual(multiRead.paymentSessions!.map((session) => [session.id, session.cashPaidSatang, session.settlements.map((settlement) => settlement.cashPaidSatang)]), [
      ['multi-person-cash', 112_500, [35_000, 60_000, 17_500]],
    ], 'one session must retain distinct selected wages for several people');
    await correctLaborPaymentSession(db, 'multi-person-cash', {
      paymentDate: '2026-08-20', method: 'cash', note: 'แก้หมายเหตุการจ่ายสามคน', reason: 'เติมหมายเหตุให้ครบ',
      settlements: [
        { recipientType: 'person', personId: su, wageAllocations: [{ payableId: firstPayables.get('su-morning')!.id, amountSatang: 35_000 }] },
        { recipientType: 'person', personId: phuang, wageAllocations: [{ payableId: firstPayables.get('phuang-hourly')!.id, amountSatang: 60_000 }] },
        { recipientType: 'person', personId: chon, wageAllocations: [{ payableId: firstPayables.get('chon-half')!.id, amountSatang: 17_500 }] },
      ],
    }, fixed('2026-08-20T02:10:00.000Z'));
    const corrected = (await getLaborMvpReadModel(db)).paymentSessions!.find((session) => session.id === 'multi-person-cash')!;
    assert.deepEqual([corrected.currentRevision, corrected.status, corrected.note], [2, 'revised', 'แก้หมายเหตุการจ่ายสามคน'], 'a payment session correction must retain a reasoned revision instead of replacing the ledger silently');
    assert.ok((await getLaborMvpReadModel(db)).timeline.some((event) => event.entityId === 'multi-person-cash' && event.action === 'payment_session_corrected' && event.reason === 'เติมหมายเหตุให้ครบ'), 'a payment session correction must append its reason to the immutable timeline');

    await recordLaborWorkItems(db, {
      workDate: '2026-08-21',
      items: [{ settlementRoute: 'group', id: 'bags-team', settlementGroupId: 'bags-group', title: 'กรอกถุงเพาะชำ', memberPersonIds: [su, phuang], quantityMilli: 4_125_000, rateSatang: 100, unitLabel: 'ถุง', collectorPersonId: su }],
    }, fixed('2026-08-21T01:00:00.000Z'));
    await postLaborPaymentSession(db, {
      id: 'team-cash', paymentDate: '2026-08-21', method: 'cash',
      settlements: [{ recipientType: 'group', settlementGroupId: 'bags-group', wageSatang: 412_500, bonusSatang: 5_000 }],
    }, fixed('2026-08-21T02:00:00.000Z'));
    const group = (await listLaborSettlementGroups(db, 'bags-team'))[0]!;
    assert.deepEqual([group.paidSatang, group.remainingSatang, group.memberPersonIds], [412_500, 0, [su, phuang]], 'group wage must settle as one lump without creating member wage shares');
    assert.equal((await listLaborPayables(db)).filter((payable) => payable.jobId === 'bags-team').length, 0, 'group payment must not manufacture member payables');

    await recordLaborWorkItems(db, {
      workDate: '2026-08-22',
      items: [
        { settlementRoute: 'individual', id: 'su-job-one', title: 'พ่นยา', participants: [{ personId: su, dueSatang: 50_000 }] },
        { settlementRoute: 'individual', id: 'su-job-two', title: 'ตัดแต่งกิ่ง', participants: [{ personId: su, dueSatang: 40_000 }] },
        { settlementRoute: 'individual', id: 'chon-open', title: 'ย้ายกระถาง', participants: [{ personId: chon, dueSatang: 30_000 }] },
      ],
    }, fixed('2026-08-22T01:00:00.000Z'));
    const advance = await createLaborWorkerAdvance(db, { id: 'su-advance', personId: su, advanceDate: '2026-08-22', amountSatang: 3_000, method: 'cash' }, fixed('2026-08-22T01:10:00.000Z'));
    const payables = new Map((await listLaborPayables(db)).map((payable) => [payable.jobId, payable]));
    await postLaborPaymentSession(db, {
      id: 'su-bonus-recovery', paymentDate: '2026-08-22', method: 'cash',
      settlements: [{
        recipientType: 'person', personId: su,
        wageAllocations: [
          { payableId: payables.get('su-job-one')!.id, amountSatang: 50_000 },
          { payableId: payables.get('su-job-two')!.id, amountSatang: 40_000 },
        ],
        bonusSatang: 500,
        advanceRecoveries: [{ advanceId: advance, payableId: payables.get('su-job-one')!.id, amountSatang: 1_000 }],
      }],
    }, fixed('2026-08-22T02:00:00.000Z'));
    const afterSu = await getLaborMvpReadModel(db);
    const suBalance = afterSu.people.find((person) => person.id === su)!;
    const suSession = afterSu.paymentSessions!.find((session) => session.id === 'su-bonus-recovery')!;
    assert.deepEqual([suSession.settlements[0]!.wageSatang, suSession.settlements[0]!.bonusSatang, suSession.settlements[0]!.advanceRecoveredSatang, suSession.settlements[0]!.cashPaidSatang], [90_000, 500, 1_000, 89_500], 'cash must reconcile exactly as wage plus bonus minus advance recovery');
    assert.deepEqual([suBalance.wageRemainingSatang, suBalance.advanceRemainingSatang, suBalance.advanceRecoveredSatang], [0, 2_000, 1_000], 'wage and advance balances must remain distinct after partial recovery');

    await recordLaborWorkItems(db, {
      workDate: '2026-08-23',
      items: [{ settlementRoute: 'individual', id: 'su-recovery-open', title: 'เก็บกวาด', participants: [{ personId: su, dueSatang: 3_000 }] }],
    }, fixed('2026-08-23T01:00:00.000Z'));
    const rejectionPayables = new Map((await listLaborPayables(db)).map((payable) => [payable.jobId, payable]));

    await assert.rejects(
      postLaborPaymentSession(db, { id: 'too-much-wage', paymentDate: '2026-08-23', settlements: [{ recipientType: 'person', personId: chon, wageAllocations: [{ payableId: rejectionPayables.get('chon-open')!.id, amountSatang: 30_001 }] }] }),
      /cannot exceed payable remaining balance/,
      'over-allocation must reject atomically',
    );
    await assert.rejects(
      postLaborPaymentSession(db, { id: 'too-much-recovery', paymentDate: '2026-08-23', settlements: [{ recipientType: 'person', personId: su, wageAllocations: [{ payableId: rejectionPayables.get('su-recovery-open')!.id, amountSatang: 3_000 }], advanceRecoveries: [{ advanceId: advance, payableId: rejectionPayables.get('su-recovery-open')!.id, amountSatang: 2_001 }] }] }),
      /cannot exceed advance remaining balance/,
      'over-recovery must reject before it can exceed worker advance debt',
    );
    await assert.rejects(
      postLaborPaymentSession(db, { id: 'cross-person-recovery', paymentDate: '2026-08-23', settlements: [{ recipientType: 'person', personId: chon, wageAllocations: [{ payableId: rejectionPayables.get('chon-open')!.id, amountSatang: 3_000 }], advanceRecoveries: [{ advanceId: advance, payableId: rejectionPayables.get('chon-open')!.id, amountSatang: 1 }] }] }),
      /same worker/,
      'cross-person recovery must reject before it can touch another worker balance',
    );
    await assert.rejects(
      postLaborPaymentSession(db, { id: 'group-recovery', paymentDate: '2026-08-23', settlements: [{ recipientType: 'group', settlementGroupId: 'bags-group', wageSatang: 1, advanceRecoveries: [{ advanceId: advance, payableId: rejectionPayables.get('su-recovery-open')!.id, amountSatang: 1 }] } as never] }),
      /cannot recover a person advance/,
      'group settlement recovery must reject instead of assigning debt to a team',
    );
    const calendar = await getLaborCalendarRange(db, { startDate: '2026-08-20', endDate: '2026-08-22' });
    assert.equal(calendar.days.find((day) => day.date === '2026-08-22')!.paymentSessionCashSatang ?? 0, 89_500, 'calendar projection must include session cash without replacing historic payment events');
    assert.ok((await getLaborMvpReadModel(db)).timeline.some((event) => event.entityId === 'su-bonus-recovery' && event.action === 'payment_session_posted'), 'payment sessions require an immutable audit event');
    console.log('LABOR_PAYMENT_SESSION_CONTRACT_PASS: multi-recipient wages, group lump, bonus, person-only advance recovery, reconciliation, and rejection guards are valid');
  } finally {
    connection?.close();
    await rm(directory, { recursive: true, force: true });
  }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
