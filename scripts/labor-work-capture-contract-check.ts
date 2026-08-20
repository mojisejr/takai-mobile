import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import {
  createLaborWorker,
  listLaborPayables,
  listLaborSettlementGroups,
  listLaborWorkBasisSnapshots,
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

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-work-capture-'));
  const databasePath = join(directory, 'takai.db');
  let connection: DatabaseSync | null = null;
  try {
    connection = new DatabaseSync(databasePath);
    const db = new NodeSqliteExecutor(connection);
    assert.deepEqual(await runMigrations(db), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    const su = await createLaborWorker(db, { id: 'worker-su', displayName: 'สุ' });
    const phuang = await createLaborWorker(db, { id: 'worker-phuang', displayName: 'พ่วง' });

    const sameDate = await recordLaborWorkItems(db, {
      workDate: '2026-08-20',
      items: [
        { settlementRoute: 'individual', id: 'su-weeding', title: 'ตัดหญ้า', participants: [{ personId: su, payType: 'daily', dueSatang: 35_000, rateSatang: 35_000, quantityMilli: 1_000 }] },
        { settlementRoute: 'individual', id: 'su-pruning', title: 'ตัดแต่งกิ่ง', participants: [{ personId: su, payType: 'daily', dueSatang: 17_500, rateSatang: 35_000, quantityMilli: 500 }] },
      ],
    }, '2026-08-20T01:00:00.000Z');
    assert.deepEqual(sameDate.map((item) => [item.settlementRoute, item.jobId]), [
      ['individual', 'su-weeding'], ['individual', 'su-pruning'],
    ], 'one work-date submission must keep two titles as two jobs');
    assert.deepEqual((await listLaborPayables(db, su)).filter((payable) => payable.workDate === '2026-08-20').map((payable) => [payable.jobId, payable.dueSatang]).sort(), [
      ['su-pruning', 17_500], ['su-weeding', 35_000],
    ], 'same worker and date must retain separate payable obligations');

    const unequalHours = await recordLaborWorkItems(db, {
      workDate: '2026-08-21',
      items: [{
        settlementRoute: 'individual', id: 'unequal-arrivals', title: 'เก็บผลไม้',
        participants: [
          { personId: su, payType: 'hourly', dueSatang: 96_000, rateSatang: 12_000, durationMinutes: 480, unitLabel: 'ชั่วโมง' },
          { personId: phuang, payType: 'hourly', dueSatang: 60_000, rateSatang: 12_000, durationMinutes: 300, unitLabel: 'ชั่วโมง' },
        ],
      }],
    }, '2026-08-21T01:00:00.000Z');
    assert.deepEqual(unequalHours, [{ settlementRoute: 'individual', jobId: 'unequal-arrivals', payableIds: ['unequal-arrivals-payable-1', 'unequal-arrivals-payable-2'] }]);
    assert.deepEqual((await listLaborWorkBasisSnapshots(db, 'unequal-arrivals')).map((snapshot) => [snapshot.personId, snapshot.durationMinutes, snapshot.totalSatang]), [
      [su, 480, 96_000], [phuang, 300, 60_000],
    ], 'one individual job must retain distinct 09:00 and 12:00 hourly obligations');

    const group = await recordLaborWorkItems(db, {
      workDate: '2026-08-22',
      items: [{
        settlementRoute: 'group', id: 'bags-team', settlementGroupId: 'bags-team-settlement', title: 'กรอกถุงเพาะชำ',
        memberPersonIds: [su, phuang], quantityMilli: 4_125_000, rateSatang: 100, unitLabel: 'ถุง', collectorPersonId: su,
      }],
    }, '2026-08-22T01:00:00.000Z');
    assert.deepEqual(group, [{ settlementRoute: 'group', jobId: 'bags-team', settlementGroupId: 'bags-team-settlement' }]);
    assert.equal((await listLaborPayables(db)).filter((payable) => payable.jobId === 'bags-team').length, 0, 'group work must not fabricate individual payables');
    assert.deepEqual((await listLaborSettlementGroups(db, 'bags-team')).map((item) => [item.originalDueSatang, item.memberPersonIds]), [
      [412_500, [su, phuang]],
    ], 'group work must retain one named-member lump settlement');
    assert.deepEqual((await listLaborWorkBasisSnapshots(db, 'bags-team')).map((snapshot) => [snapshot.settlementRoute, snapshot.personId, snapshot.totalSatang]), [
      ['group', null, 412_500],
    ], 'group basis must not imply a member share');

    await assert.rejects(
      recordLaborWorkItems(db, {
        workDate: '2026-08-23',
        items: [
          { settlementRoute: 'individual', id: 'rolled-back-first', title: 'งานแรก', participants: [{ personId: su, dueSatang: 35_000 }] },
          { settlementRoute: 'individual', id: 'rolled-back-second', title: 'งานที่ผิด', participants: [{ personId: 'missing-worker', dueSatang: 35_000 }] },
        ],
      }),
      /worker is unavailable/,
      'a later invalid row must reject the whole work-record submission',
    );
    assert.equal((await db.getAllAsync<{ count: number }>('SELECT COUNT(*) AS count FROM labor_jobs WHERE id IN (?, ?)', ['rolled-back-first', 'rolled-back-second']))[0]!.count, 0, 'transaction failure must leave no earlier job behind');

    console.log('LABOR_WORK_CAPTURE_CONTRACT_PASS: multi-item atomic jobs, unequal individual hourly dues, and group lump settlement route are valid');
  } finally {
    connection?.close();
    await rm(directory, { recursive: true, force: true });
  }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
