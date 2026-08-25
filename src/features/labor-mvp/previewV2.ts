import type { SqlExecutor } from '../../data/migrations';
import { createLaborWorker } from './repository';
import { archiveLaborV2Chemical, archiveLaborV2Plot, createLaborV2Chemical, createLaborV2PersonAdvance, createLaborV2Plot, getLaborV2ChemicalDetail, finalizeLaborContractBatchV2, getLaborV2MoneyHistory, getLaborV2PaymentBatchDraft, getLaborV2PlotDetail, getLaborV2ReadModel, getPersonDetailV2, listLaborV2Chemicals, listLaborV2Plots, markLaborV2ChemicalEmpty, postLaborV2PaymentSession, recordLaborDayV2, recordLaborContractProgressV2, startLaborContractBatchV2, updateLaborV2Chemical, updateLaborV2Plot } from './repositoryV2';
import type { LaborV2Chemical, LaborV2ChemicalDetail, LaborV2MoneyHistory, LaborV2PaymentBatchDraftItem, LaborV2PersonDetail, LaborV2Plot, LaborV2PlotDetail, LaborV2ReadModel } from './types';

export const LABOR_V2_PREVIEW_FIXTURE_VERSION = 'labor-v2-preview-v1' as const;

/** Removes runtime UUIDs only after the repository has produced the projection. */
export const normalizeLaborV2PreviewReadModel = (model: LaborV2ReadModel): LaborV2ReadModel => ({
  ...model,
  events: normalizeLaborV2PreviewEvents(model.events),
});

const normalizeLaborV2PreviewEvents = (events: LaborV2ReadModel['events']): LaborV2ReadModel['events'] => [...events]
  .sort((left, right) => `${left.occurredAt}|${left.entityType}|${left.entityId}|${left.action}`.localeCompare(`${right.occurredAt}|${right.entityType}|${right.entityId}|${right.action}`))
  .map((event, index) => ({ ...event, id: `labor-v2-preview-event-${index + 1}` }));
const normalizeLaborV2PreviewMoneyHistory = (history: LaborV2MoneyHistory): LaborV2MoneyHistory => ({ ...history, events: normalizeLaborV2PreviewEvents(history.events) });
const normalizeLaborV2PreviewPersonDetail = (detail: LaborV2PersonDetail): LaborV2PersonDetail => ({ ...detail, events: normalizeLaborV2PreviewEvents(detail.events) });
const normalizeLaborV2PreviewPlotDetail = (detail: LaborV2PlotDetail): LaborV2PlotDetail => ({ ...detail, revisions: detail.revisions.map((revision) => ({ ...revision, id: `labor-v2-preview-plot-revision-${detail.id}-${revision.revision}` })) });
const normalizeLaborV2PreviewChemicalDetail = (detail: LaborV2ChemicalDetail): LaborV2ChemicalDetail => ({ ...detail, revisions: detail.revisions.map((revision) => ({ ...revision, id: `labor-v2-preview-chemical-revision-${detail.id}-${revision.revision}` })) });

export type LaborV2PreviewFixture = {
  version: typeof LABOR_V2_PREVIEW_FIXTURE_VERSION;
  openBatchObligationCount: number;
  readModel: LaborV2ReadModel;
  paymentBatchItems: LaborV2PaymentBatchDraftItem[];
  moneyHistory: LaborV2MoneyHistory;
  personDetails: Record<string, LaborV2PersonDetail>;
  plots: { active: LaborV2Plot[]; includingArchived: LaborV2Plot[]; details: Record<string, LaborV2PlotDetail> };
  chemicals: { active: LaborV2Chemical[]; includingArchived: LaborV2Chemical[]; details: Record<string, LaborV2ChemicalDetail> };
};

/** V2-only fixture sequence. It is a repository-command recipe, never a UI adapter. */
export const buildLaborV2PreviewFixture = async (db: SqlExecutor): Promise<LaborV2PreviewFixture> => {
  const su = await createLaborWorker(db, { id: 'labor-v2-preview-su', displayName: 'พี่สุ' }, '2026-08-21T08:00:00.000Z');
  const phuang = await createLaborWorker(db, { id: 'labor-v2-preview-phuang', displayName: 'พี่พวง' }, '2026-08-21T08:00:01.000Z');
  const chon = await createLaborWorker(db, { id: 'labor-v2-preview-chon', displayName: 'น้าชล' }, '2026-08-21T08:00:02.000Z');
  const north = await createLaborV2Plot(db, { id: 'labor-v2-preview-plot-north', name: 'แปลง A', cropLabel: 'ทุเรียน', latitude: 13.7563, longitude: 100.5018 }, '2026-08-21T08:00:03.000Z');
  const east = await createLaborV2Plot(db, { id: 'labor-v2-preview-plot-east', name: 'แปลง B', cropLabel: 'มังคุด' }, '2026-08-21T08:00:04.000Z');
  const pond = await createLaborV2Plot(db, { id: 'labor-v2-preview-plot-pond', name: 'แปลงริมสระ', cropLabel: 'มะพร้าว' }, '2026-08-21T08:00:05.000Z');
  const olderMancozeb = await createLaborV2Chemical(db, { id: 'labor-v2-preview-chemical-mancozeb-old', commonName: 'แมนโคเซบ', brandName: 'สูตรเดิม', chemicalGroup: 'M03', referenceAmount: 300, referenceUnit: 'g', referenceWaterLitres: 200, addedOn: '2026-08-20' }, '2026-08-20T08:00:00.000Z');
  const latestMancozeb = await createLaborV2Chemical(db, { id: 'labor-v2-preview-chemical-mancozeb-new', commonName: 'แมนโคเซบ', brandName: 'สูตรใหม่', chemicalGroup: 'M03', referenceAmount: 250, referenceUnit: 'g', referenceWaterLitres: 200, addedOn: '2026-08-24' }, '2026-08-24T08:00:00.000Z');
  await recordLaborDayV2(db, { workDate: '2026-08-21', tasks: [{ id: 'labor-v2-preview-task-1', title: 'ตัดหญ้า', assigneePersonIds: [su], plotTargets: [{ plotId: north, treeLabels: ['A-014', 'ต้นริมรั้ว'] }, { plotId: pond, treeLabels: ['P-003'] }] }, { id: 'labor-v2-preview-task-2', title: 'ใส่ปุ๋ย', assigneePersonIds: [su] }, { id: 'labor-v2-preview-task-3', title: 'พ่นยารอบเช้า', assigneePersonIds: [su], plotTargets: [{ plotId: east, treeLabels: ['B-002'] }], chemicalMix: { waterLitres: 50, uses: [{ chemicalId: olderMancozeb }] } }], daily: [{ id: 'labor-v2-preview-daily', personId: su, rateSatang: 35_000, quantityMilli: 1000, taskIds: ['labor-v2-preview-task-1', 'labor-v2-preview-task-2', 'labor-v2-preview-task-3'] }] }, '2026-08-21T08:01:00.000Z');
  await updateLaborV2Chemical(db, olderMancozeb, { commonName: 'แมนโคเซบ สูตรเดิม', referenceAmount: 600, referenceUnit: 'g', referenceWaterLitres: 200, reason: 'แก้ข้อมูลหลังบันทึกงาน' }, '2026-08-22T08:00:00.000Z');
  await archiveLaborV2Chemical(db, olderMancozeb, 'เก็บสูตรเดิมไว้ดูประวัติ', '2026-08-22T08:01:00.000Z');
  await markLaborV2ChemicalEmpty(db, latestMancozeb, 'ใช้หมดแล้ว', '2026-08-24T08:01:00.000Z');
  await updateLaborV2Plot(db, north, { name: 'แปลงทุเรียนโซนเหนือ', reason: 'ตั้งชื่อตามชนิดพืช' }, '2026-08-21T08:01:30.000Z');
  await archiveLaborV2Plot(db, east, 'ย้ายไปรวมโซนเหนือ', '2026-08-21T08:01:31.000Z');
  const batch = await startLaborContractBatchV2(db, { id: 'labor-v2-preview-contract', title: 'กรอกถุงเพาะชำ', startsOn: '2026-08-21', memberPersonIds: [su, phuang] }, '2026-08-21T08:02:00.000Z');
  await recordLaborContractProgressV2(db, batch, { progressDate: '2026-08-22', note: 'เริ่มทำ' }, '2026-08-22T08:00:00.000Z');
  const openBatchObligationCount = (await getLaborV2ReadModel(db)).obligations.filter((item) => item.sourceKind === 'contract').length;
  const contractObligation = await finalizeLaborContractBatchV2(db, batch, { finalizedAt: '2026-08-23', finalization: { kind: 'quantity_rate', quantityMilli: 4_125_000, rateSatang: 100, unitLabel: 'ถุง' } }, '2026-08-23T08:00:00.000Z');
  await recordLaborDayV2(db, { workDate: '2026-08-24', tasks: [{ id: 'labor-v2-preview-hourly-su', title: 'เก็บกิ่ง', assigneePersonIds: [su] }, { id: 'labor-v2-preview-hourly-chon', title: 'ล้างถัง', assigneePersonIds: [chon] }], hourly: [{ id: 'labor-v2-preview-time-su', taskId: 'labor-v2-preview-hourly-su', personId: su, rateSatang: 12_000, durationMinutes: 120 }, { id: 'labor-v2-preview-time-chon', taskId: 'labor-v2-preview-hourly-chon', personId: chon, rateSatang: 12_000, durationMinutes: 30 }] }, '2026-08-24T08:00:00.000Z');
  const advance = await createLaborV2PersonAdvance(db, { id: 'labor-v2-preview-advance', personId: su, advanceDate: '2026-08-24', amountSatang: 10_000 }, '2026-08-24T08:01:00.000Z');
  await postLaborV2PaymentSession(db, { id: 'labor-v2-preview-payment', paymentDate: '2026-08-24', method: 'cash', settlements: [{ obligationId: 'obligation:daily:labor-v2-preview-daily', wageSatang: 35_000 }, { obligationId: 'obligation:hourly:hourly:labor-v2-preview-su|2026-08-24|12000|', wageSatang: 12_000, bonusSatang: 1_000, advanceRecoveries: [{ advanceId: advance, amountSatang: 5_000 }] }, { obligationId: contractObligation, wageSatang: 412_500 }] }, '2026-08-24T08:02:00.000Z');
  const [readModel, paymentBatchDraft, moneyHistory, suDetail, phuangDetail, chonDetail, activePlots, allPlots, northDetail, eastDetail, pondDetail, activeChemicals, allChemicals, olderMancozebDetail, latestMancozebDetail] = await Promise.all([
    getLaborV2ReadModel(db),
    getLaborV2PaymentBatchDraft(db),
    getLaborV2MoneyHistory(db),
    getPersonDetailV2(db, su),
    getPersonDetailV2(db, phuang),
    getPersonDetailV2(db, chon),
    listLaborV2Plots(db),
    listLaborV2Plots(db, true),
    getLaborV2PlotDetail(db, north),
    getLaborV2PlotDetail(db, east),
    getLaborV2PlotDetail(db, pond),
    listLaborV2Chemicals(db),
    listLaborV2Chemicals(db, true),
    getLaborV2ChemicalDetail(db, olderMancozeb),
    getLaborV2ChemicalDetail(db, latestMancozeb),
  ]);
  return {
    version: LABOR_V2_PREVIEW_FIXTURE_VERSION,
    openBatchObligationCount,
    readModel: normalizeLaborV2PreviewReadModel(readModel),
    paymentBatchItems: paymentBatchDraft.available,
    moneyHistory: normalizeLaborV2PreviewMoneyHistory(moneyHistory),
    personDetails: { [su]: normalizeLaborV2PreviewPersonDetail(suDetail), [phuang]: normalizeLaborV2PreviewPersonDetail(phuangDetail), [chon]: normalizeLaborV2PreviewPersonDetail(chonDetail) },
    plots: { active: activePlots, includingArchived: allPlots, details: { [north]: normalizeLaborV2PreviewPlotDetail(northDetail), [east]: normalizeLaborV2PreviewPlotDetail(eastDetail), [pond]: normalizeLaborV2PreviewPlotDetail(pondDetail) } },
    chemicals: { active: activeChemicals, includingArchived: allChemicals, details: { [olderMancozeb]: normalizeLaborV2PreviewChemicalDetail(olderMancozebDetail), [latestMancozeb]: normalizeLaborV2PreviewChemicalDetail(latestMancozebDetail) } },
  };
};
