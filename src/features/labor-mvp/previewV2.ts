import type { SqlExecutor } from '../../data/migrations';
import { createLaborWorker, createLaborWorkerAdvance } from './repository';
import { finalizeLaborContractBatchV2, getLaborV2ReadModel, postLaborV2PaymentSession, recordLaborDayV2, recordLaborContractProgressV2, startLaborContractBatchV2 } from './repositoryV2';
import type { LaborV2ReadModel } from './types';

export const LABOR_V2_PREVIEW_FIXTURE_VERSION = 'labor-v2-preview-v1' as const;

/** Removes runtime UUIDs only after the repository has produced the projection. */
export const normalizeLaborV2PreviewReadModel = (model: LaborV2ReadModel): LaborV2ReadModel => ({
  ...model,
  events: [...model.events]
    .sort((left, right) => `${left.occurredAt}|${left.entityType}|${left.entityId}|${left.action}`.localeCompare(`${right.occurredAt}|${right.entityType}|${right.entityId}|${right.action}`))
    .map((event, index) => ({ ...event, id: `labor-v2-preview-event-${index + 1}` })),
});

export type LaborV2PreviewFixture = {
  version: typeof LABOR_V2_PREVIEW_FIXTURE_VERSION;
  openBatchObligationCount: number;
  readModel: LaborV2ReadModel;
};

/** V2-only fixture sequence. It is a repository-command recipe, never a UI adapter. */
export const buildLaborV2PreviewFixture = async (db: SqlExecutor): Promise<LaborV2PreviewFixture> => {
  const su = await createLaborWorker(db, { id: 'labor-v2-preview-su', displayName: 'พี่สุ' }, '2026-08-21T08:00:00.000Z');
  const phuang = await createLaborWorker(db, { id: 'labor-v2-preview-phuang', displayName: 'พี่พวง' }, '2026-08-21T08:00:01.000Z');
  const chon = await createLaborWorker(db, { id: 'labor-v2-preview-chon', displayName: 'น้าชล' }, '2026-08-21T08:00:02.000Z');
  await recordLaborDayV2(db, { workDate: '2026-08-21', tasks: [{ id: 'labor-v2-preview-task-1', title: 'ตัดหญ้า', assigneePersonIds: [su] }, { id: 'labor-v2-preview-task-2', title: 'ใส่ปุ๋ย', assigneePersonIds: [su] }, { id: 'labor-v2-preview-task-3', title: 'พ่นยา', assigneePersonIds: [su] }], daily: [{ id: 'labor-v2-preview-daily', personId: su, rateSatang: 35_000, quantityMilli: 1000, taskIds: ['labor-v2-preview-task-1', 'labor-v2-preview-task-2', 'labor-v2-preview-task-3'] }] }, '2026-08-21T08:01:00.000Z');
  const batch = await startLaborContractBatchV2(db, { id: 'labor-v2-preview-contract', title: 'กรอกถุงเพาะชำ', startsOn: '2026-08-21', memberPersonIds: [su, phuang] }, '2026-08-21T08:02:00.000Z');
  await recordLaborContractProgressV2(db, batch, { progressDate: '2026-08-22', note: 'เริ่มทำ' }, '2026-08-22T08:00:00.000Z');
  const openBatchObligationCount = (await getLaborV2ReadModel(db)).obligations.filter((item) => item.sourceKind === 'contract').length;
  const contractObligation = await finalizeLaborContractBatchV2(db, batch, { finalizedAt: '2026-08-23', finalization: { kind: 'quantity_rate', quantityMilli: 4_125_000, rateSatang: 100, unitLabel: 'ถุง' } }, '2026-08-23T08:00:00.000Z');
  await recordLaborDayV2(db, { workDate: '2026-08-24', tasks: [{ id: 'labor-v2-preview-hourly-su', title: 'เก็บกิ่ง', assigneePersonIds: [su] }, { id: 'labor-v2-preview-hourly-chon', title: 'ล้างถัง', assigneePersonIds: [chon] }], hourly: [{ id: 'labor-v2-preview-time-su', taskId: 'labor-v2-preview-hourly-su', personId: su, rateSatang: 12_000, durationMinutes: 120 }, { id: 'labor-v2-preview-time-chon', taskId: 'labor-v2-preview-hourly-chon', personId: chon, rateSatang: 12_000, durationMinutes: 30 }] }, '2026-08-24T08:00:00.000Z');
  const advance = await createLaborWorkerAdvance(db, { id: 'labor-v2-preview-advance', personId: su, advanceDate: '2026-08-24', amountSatang: 10_000 }, '2026-08-24T08:01:00.000Z');
  await postLaborV2PaymentSession(db, { id: 'labor-v2-preview-payment', paymentDate: '2026-08-24', method: 'cash', settlements: [{ obligationId: 'obligation:daily:labor-v2-preview-daily', wageSatang: 35_000 }, { obligationId: 'obligation:hourly:hourly:labor-v2-preview-su|2026-08-24|12000|', wageSatang: 12_000, bonusSatang: 1_000, advanceRecoveries: [{ advanceId: advance, amountSatang: 5_000 }] }, { obligationId: contractObligation, wageSatang: 412_500 }] }, '2026-08-24T08:02:00.000Z');
  return { version: LABOR_V2_PREVIEW_FIXTURE_VERSION, openBatchObligationCount, readModel: normalizeLaborV2PreviewReadModel(await getLaborV2ReadModel(db)) };
};
