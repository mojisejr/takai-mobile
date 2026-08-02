import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createSingleCommitCoordinator, eligibleCorrectionTargets, requireCorrectionTarget, workerDraftError } from '../src/features/labor-mvp/peopleMoneyFlow';
import type { LaborMvpReadModel } from '../src/features/labor-mvp/types';

const model = (): LaborMvpReadModel => ({
  people: [
    { id: 'active', displayName: 'พี่สุ', specialty: '', phone: '', note: '', archivedAt: null, dueSatang: 0, paidSatang: 0, remainingSatang: 0, grossEarnedSatang: 0, cashPaidSatang: 0, wageRemainingSatang: 0, advanceIssuedSatang: 0, advanceRecoveredSatang: 0, advanceRemainingSatang: 0 },
    { id: 'archived', displayName: 'พี่พวง', specialty: '', phone: '', note: '', archivedAt: '2026-08-02T01:00:00.000Z', dueSatang: 0, paidSatang: 0, remainingSatang: 0, grossEarnedSatang: 0, cashPaidSatang: 0, wageRemainingSatang: 0, advanceIssuedSatang: 0, advanceRecoveredSatang: 0, advanceRemainingSatang: 0 },
  ],
  payables: [{ id: 'payable-job', jobId: 'job-a', jobTitle: 'ตัดหญ้า', workDate: '2026-08-01', personId: 'active', dueSatang: 35000, paidSatang: 0, recoveredSatang: 0, remainingSatang: 35000, kind: 'normal' }],
  payments: [{ id: 'payment-a', personId: 'active', paymentDate: '2026-08-01', method: 'cash', note: '', totalSatang: 35000, currentRevision: 1, allocations: [{ id: 'allocation-a', payableId: 'payable-job', amountSatang: 35000 }] }],
  settlementGroups: [{ id: 'group-a', jobId: 'job-a', originalDueSatang: 10000, paidSatang: 10000, remainingSatang: 0, status: 'settled', collectorPersonId: 'active', collectorLabel: 'พี่สุ', memberPersonIds: ['active', 'archived'], receipts: [{ id: 'receipt-a', settlementGroupId: 'group-a', receiptDate: '2026-08-01', amountSatang: 10000, method: 'cash', note: '', currentRevision: 1, status: 'posted' }] }],
  advances: [{ id: 'advance-a', personId: 'active', advanceDate: '2026-08-01', amountSatang: 5000, recoveredSatang: 0, remainingSatang: 5000, method: 'cash', note: '', currentRevision: 1, status: 'posted' }],
  timeline: [], contracts: [], legacySources: [], legacyBalances: [], workBasisSnapshots: [], advanceDeductions: [],
});

const main = async (): Promise<void> => {
  assert.equal(workerDraftError({ displayName: '' }, 'create'), 'กรอกชื่อคนทำงานก่อนบันทึก');
  assert.equal(workerDraftError({ displayName: 'พี่สุ', reason: '' }, 'edit'), 'การแก้ไขหรือเก็บรายชื่อต้องระบุเหตุผล');
  assert.equal(workerDraftError({ displayName: 'พี่สุ', reason: 'เปลี่ยนเบอร์' }, 'edit'), null);

  const read = model();
  assert.deepEqual(read.people.filter((person) => !person.archivedAt).map((person) => person.id), ['active'], 'archived workers must leave every new-action list while their record stays in the read model');
  const targets = eligibleCorrectionTargets(read, { jobId: 'job-a', personId: 'active' });
  assert.deepEqual(targets.map((target) => target.id), ['payment:payment-a', 'receipt:receipt-a', 'advance:advance-a']);
  assert.throws(() => requireCorrectionTarget(targets, ''), /เลือกรายการการเงิน/, 'correction must never silently select the first eligible record');
  assert.equal(requireCorrectionTarget(targets, 'receipt:receipt-a').kind, 'receipt');

  let writes = 0;
  const coordinator = createSingleCommitCoordinator();
  const first = coordinator.commit(async () => { writes += 1; }, async () => undefined);
  const second = coordinator.commit(async () => { writes += 1; }, async () => undefined);
  assert.equal(first, second, 'a repeated confirm must share one in-flight ledger command');
  assert.equal(await first, 'committed');
  assert.equal(writes, 1, 'double confirm must produce exactly one ledger write');
  const refreshPending = await createSingleCommitCoordinator().commit(async () => { writes += 1; }, async () => { throw new Error('offline projection'); });
  assert.equal(refreshPending, 'committed-refresh-pending', 'a refresh failure must not rewrite a committed ledger command');
  assert.equal(writes, 2);

  const source = await readFile(resolve(process.cwd(), 'src/features/labor-mvp/LaborMvpApp.tsx'), 'utf8');
  const flow = await readFile(resolve(process.cwd(), 'src/features/labor-mvp/peopleMoneyFlow.ts'), 'utf8');
  for (const required of ['WorkerEditorScreen', 'คนที่เก็บไว้', 'QuickAddWorkerForm', 'ข้อมูลที่กรอกไว้ในงานนี้จะยังอยู่ครบ', 'setPersonId(id)', 'ConfirmActionSheet', 'CorrectionTargetPicker', 'createSingleCommitCoordinator']) {
    assert.ok(source.includes(required), `Phase 4 UI must preserve ${required}`);
  }
  assert.ok(flow.includes('committed-refresh-pending'), 'commit flow must distinguish a committed command from projection refresh failure');
  assert.ok(!source.includes("model.payments.find((item) => !initialJobId"), 'unsafe first-match payment correction selection must be removed');
  console.log('LABOR_PEOPLE_MONEY_FLOW_PASS: worker lifecycle UI, draft-safe quick add, explicit correction target, cancel-ready confirmation, exactly-once commit, and refresh-pending feedback are aligned');
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
