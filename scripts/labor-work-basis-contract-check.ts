import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import { TAKAI_MIGRATIONS } from '../src/data/schema';
import {
  addLaborContractProgress,
  completeLaborContractWork,
  createGroupPieceWork,
  createLaborContract,
  createLaborSettlementGroup,
  createLaborWorker,
  createNormalWork,
  getLaborMvpReadModel,
  listLaborPayables,
  listLaborSettlementGroups,
  listLaborWorkBasisSnapshots,
  postLaborPayment,
  postLaborSettlementGroupReceipt,
  reconcileLaborContractShares,
} from '../src/features/labor-mvp';

class NodeSqliteExecutor implements SqlExecutor {
  constructor(private readonly database: DatabaseSync) {}
  async execAsync(sql: string): Promise<void> { this.database.exec(sql); }
  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> { return this.database.prepare(sql).all(...(params as SQLInputValue[])) as T[]; }
  async runAsync(sql: string, params: unknown[] = []): Promise<void> { this.database.prepare(sql).run(...(params as SQLInputValue[])); }
}

const applyThroughTwelve = async (db: NodeSqliteExecutor): Promise<void> => {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.execAsync('CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
  for (const migration of TAKAI_MIGRATIONS.filter((item) => item.id <= 12)) {
    for (const statement of migration.statements) await db.execAsync(statement);
    await db.runAsync('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)', [migration.id, migration.name, '2026-07-31T00:00:00.000Z']);
  }
};

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-work-basis-'));
  const databasePath = join(directory, 'takai.db');
  let firstConnection: DatabaseSync | null = null;
  let secondConnection: DatabaseSync | null = null;
  try {
    firstConnection = new DatabaseSync(databasePath);
    const db = new NodeSqliteExecutor(firstConnection);
    await applyThroughTwelve(db);
    assert.deepEqual(await runMigrations(db), [13, 14, 15], 'schema-12 upgrade must add immutable work-basis, hourly-duration, and advance-recovery surfaces');
    const su = await createLaborWorker(db, { id: 'worker-su', displayName: 'สุ' });
    const phuang = await createLaborWorker(db, { id: 'worker-phuang', displayName: 'พ่วง' });

    const individual = await createNormalWork(db, {
      id: 'daily-chon', title: 'เก็บกิ่งครึ่งวัน', workDate: '2026-07-31',
      participants: [{ personId: su, payType: 'daily', dueSatang: 17_500, rateSatang: 35_000, quantityMilli: 500, unitLabel: 'วัน' }],
    }, '2026-07-31T01:00:00.000Z');
    assert.deepEqual((await listLaborPayables(db)).filter((payable) => payable.jobId === individual.jobId).map((payable) => payable.dueSatang), [17_500], 'half-day work must create only the worker’s exact individual due');
    assert.deepEqual((await listLaborWorkBasisSnapshots(db, individual.jobId)).map((snapshot) => [snapshot.settlementRoute, snapshot.basisKind, snapshot.personId, snapshot.rateSatang, snapshot.quantityMilli, snapshot.durationMinutes, snapshot.totalSatang]), [
      ['individual', 'daily', su, 35_000, 500, null, 17_500],
    ], 'daily basis is limited to half or full day and is immutable');
    await assert.rejects(
      createNormalWork(db, { title: 'รายวันผิดรูปแบบ', workDate: '2026-07-31', participants: [{ personId: su, payType: 'daily', dueSatang: 87_500, rateSatang: 35_000, quantityMilli: 2_500 }] }),
      /full day or half day only/,
      'daily work must reject arbitrary fractional quantities',
    );
    await assert.rejects(
      createNormalWork(db, { title: 'รายชั่วโมงผิดรูปแบบ', workDate: '2026-07-31', participants: [{ personId: su, payType: 'hourly', dueSatang: 12_000, rateSatang: 12_000, quantityMilli: 1_000, durationMinutes: 60 }] }),
      /without quantity/,
      'hourly work must reject a quantity alongside duration',
    );
    await assert.rejects(
      createNormalWork(db, { title: 'รายชั่วโมงเศษสตางค์', workDate: '2026-07-31', participants: [{ personId: su, payType: 'hourly', dueSatang: 1, rateSatang: 1_000, durationMinutes: 1 }] }),
      /whole satang/,
      'hourly work must reject a duration whose rate would create fractional satang',
    );
    const hourly = await createNormalWork(db, {
      id: 'hourly-chon', title: 'เก็บกิ่งรายชั่วโมง', workDate: '2026-07-31',
      participants: [{ personId: su, payType: 'hourly', dueSatang: 18_000, rateSatang: 12_000, durationMinutes: 90, unitLabel: 'ชั่วโมง' }],
    }, '2026-07-31T01:01:00.000Z');
    const piece = await createNormalWork(db, {
      id: 'piece-chon', title: 'ขนของรายชิ้น', workDate: '2026-07-31',
      participants: [{ personId: su, payType: 'piece', dueSatang: 200, rateSatang: 100, quantityMilli: 2_000, unitLabel: 'ชิ้น' }],
    }, '2026-07-31T01:02:00.000Z');
    assert.deepEqual((await listLaborWorkBasisSnapshots(db, hourly.jobId)).map((snapshot) => [snapshot.basisKind, snapshot.quantityMilli, snapshot.durationMinutes, snapshot.totalSatang]), [['hourly', null, 90, 18_000]], 'hourly rate times whole duration minutes must persist without a quantity');
    await postLaborPayment(db, {
      id: 'combined-same-date-payment', personId: su, paymentDate: '2026-07-31',
      allocations: [
        { payableId: individual.payableIds[0]!, amountSatang: 17_500 },
        { payableId: hourly.payableIds[0]!, amountSatang: 18_000 },
        { payableId: piece.payableIds[0]!, amountSatang: 200 },
      ],
    }, '2026-07-31T02:00:00.000Z');
    assert.deepEqual((await listLaborPayables(db, su)).filter((payable) => [individual.jobId, hourly.jobId, piece.jobId].includes(payable.jobId)).map((payable) => [payable.jobId, payable.remainingSatang]).sort(), [
      [individual.jobId, 0], [hourly.jobId, 0], [piece.jobId, 0],
    ], 'same worker and date can settle selected half-day, hourly, and piece payables together without merging their work basis');

    const groupPiece = await createGroupPieceWork(db, {
      id: 'group-bags', settlementGroupId: 'group-bags-settlement', title: 'เก็บกระสอบรวม', workDate: '2026-08-01',
      memberPersonIds: [su, phuang], quantityMilli: 4_125_000, rateSatang: 100, unitLabel: 'กระสอบ', collectorPersonId: su,
    }, '2026-08-01T01:00:00.000Z');
    const groupPieceSnapshot = await listLaborWorkBasisSnapshots(db, groupPiece.jobId);
    assert.deepEqual(groupPieceSnapshot.map((snapshot) => [snapshot.settlementRoute, snapshot.personId, snapshot.quantityMilli, snapshot.totalSatang]), [
      ['group', null, 4_125_000, 412_500],
    ], 'team output must be recorded once with no person share snapshot');
    assert.equal((await listLaborPayables(db)).filter((payable) => payable.jobId === groupPiece.jobId).length, 0, 'group aggregate output must create no individual payable');
    assert.deepEqual((await listLaborSettlementGroups(db, groupPiece.jobId))[0]!.memberPersonIds, [su, phuang]);

    const groupContract = await createLaborContract(db, {
      id: 'group-contract', title: 'งานเหมารวม', workDate: '2026-08-02', settlementRoute: 'group', participants: [{ personId: su }, { personId: phuang }],
    }, '2026-08-02T01:00:00.000Z');
    await addLaborContractProgress(db, groupContract, { id: 'group-contract-progress', progressDate: '2026-08-03', note: 'เก็บได้บางส่วน', quantityMilli: 1_000_000, unitLabel: 'กระสอบ' }, '2026-08-03T01:00:00.000Z');
    await assert.rejects(
      createLaborSettlementGroup(db, { laborJobId: groupContract, originalDueSatang: 400_000, memberPersonIds: [su, phuang] }),
      /requires completed final output/,
      'group contract cannot settle before final output is recorded',
    );
    await completeLaborContractWork(db, groupContract, {
      id: 'group-contract-final', completedOn: '2026-08-04', finalTotalSatang: 400_000, rateSatang: 100, quantityMilli: 4_000_000, unitLabel: 'กระสอบ', note: 'จบงานจริง',
    }, '2026-08-04T01:00:00.000Z');
    await assert.rejects(
      createLaborSettlementGroup(db, { laborJobId: groupContract, originalDueSatang: 399_900, memberPersonIds: [su, phuang] }),
      /must equal the immutable completed total/,
      'group due cannot diverge from final aggregate output',
    );
    const groupContractSettlement = await createLaborSettlementGroup(db, { id: 'group-contract-settlement', laborJobId: groupContract, originalDueSatang: 400_000, memberPersonIds: [su, phuang] }, '2026-08-04T02:00:00.000Z');
    await postLaborSettlementGroupReceipt(db, { settlementGroupId: groupContractSettlement, receiptDate: '2026-08-05', amountSatang: 100_000 }, '2026-08-05T01:00:00.000Z');
    await assert.rejects(
      reconcileLaborContractShares(db, groupContract, { totalSatang: 400_000, shares: [{ personId: su, amountSatang: 200_000 }, { personId: phuang, amountSatang: 200_000 }] }),
      /settlement route is group, not individual/,
      'posted group receipt prevents a route switch into individual shares',
    );
    await assert.rejects(
      db.runAsync("UPDATE labor_work_basis_snapshots SET quantity_milli = 1 WHERE id = 'group-contract-final'"),
      /immutable/,
      'source quantity and due snapshot cannot mutate after receipt',
    );

    const individualContract = await createLaborContract(db, {
      id: 'individual-contract', title: 'งานเหมาจ่ายแยกคน', workDate: '2026-08-06', settlementRoute: 'individual', participants: [{ personId: su }, { personId: phuang }],
    }, '2026-08-06T01:00:00.000Z');
    await completeLaborContractWork(db, individualContract, { completedOn: '2026-08-07', finalTotalSatang: 100_000 }, '2026-08-07T01:00:00.000Z');
    const individualPayables = await reconcileLaborContractShares(db, individualContract, {
      totalSatang: 100_000, shares: [{ personId: su, amountSatang: 60_000 }, { personId: phuang, amountSatang: 40_000 }],
    }, '2026-08-07T02:00:00.000Z');
    assert.equal(individualPayables.length, 2, 'explicit individual contract shares remain supported when the chosen route is individual');

    const firstRead = await getLaborMvpReadModel(db);
    firstConnection.close();
    firstConnection = null;
    secondConnection = new DatabaseSync(databasePath);
    const reopened = new NodeSqliteExecutor(secondConnection);
    assert.deepEqual(await getLaborMvpReadModel(reopened), firstRead, 'work-basis, route, and legacy ledgers must survive close/reopen');
    console.log('LABOR_WORK_BASIS_CONTRACT_PASS: full/half daily work, hourly durations, one-time group output, explicit routes, completed contracts, and receipt locks are valid');
  } finally {
    secondConnection?.close();
    firstConnection?.close();
    await rm(directory, { recursive: true, force: true });
  }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
