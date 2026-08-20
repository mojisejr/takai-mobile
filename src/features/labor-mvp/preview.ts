import type { SqlExecutor } from '../../data/migrations';
import {
  addLaborContractProgress,
  applyLaborAdvanceDeduction,
  completeLaborContractWork,
  createGroupPieceWork,
  createLaborContract,
  createLaborSettlementGroup,
  createLaborWorker,
  archiveLaborWorker,
  createLaborWorkerAdvance,
  createNormalWork,
  getLaborCalendarRange,
  getLaborHistory,
  getLaborJobDetail,
  getLaborMvpReadModel,
  getLaborPersonDetail,
  getLaborTodaySummary,
  listLaborWorkers,
  updateLaborWorker,
  editLaborPayment,
  editLaborSettlementGroupReceipt,
  editLaborWorkerAdvance,
  postLaborPayment,
  postLaborSettlementGroupReceipt,
  recordLaborWorkItems,
} from './repository';
import type { AddContractProgressInput, ApplyLaborAdvanceDeductionInput, CompleteLaborContractWorkInput, CreateGroupPieceWorkInput, CreateLaborContractInput, CreateLaborSettlementGroupInput, CreateLaborWorkerAdvanceInput, CreateNormalWorkInput, EditLaborPaymentInput, EditLaborSettlementGroupReceiptInput, EditLaborWorkerAdvanceInput, LaborCalendarRange, LaborCalendarRangeInput, LaborHistory, LaborHistoryInput, LaborJobDetail, LaborMvpReadModel, LaborPersonDetail, LaborTodaySummary, LaborWorker, LaborWorkerInput, PostLaborPaymentInput, PostLaborSettlementGroupReceiptInput, RecordedLaborWorkItem, RecordLaborWorkItemsInput, UpdateLaborWorkerInput } from './types';

export const LABOR_PREVIEW_FIXTURE = {
  version: 'labor-preview-v1',
  recordedAt: '2026-08-02T08:00:00.000Z',
  people: {
    suda: { id: 'labor-preview-suda', displayName: 'พี่สุ', specialty: 'งานรายวันและกรอกถุง' },
    phuang: { id: 'labor-preview-phuang', displayName: 'พี่พวง', specialty: 'กรอกถุงเพาะชำ' },
    chon: { id: 'labor-preview-chon', displayName: 'น้าชล', specialty: 'งานรายชั่วโมง' },
  },
} as const;

export type LaborPreviewAdapter = {
  mode: 'notebook' | 'proof';
  platform: 'native-notebook' | 'web-notebook' | 'native-preview' | 'web-preview';
  label?: string;
  fixtureVersion?: typeof LABOR_PREVIEW_FIXTURE.version;
  getReadModel: () => Promise<LaborMvpReadModel>;
  getTodaySummary: (date?: string) => Promise<LaborTodaySummary>;
  getCalendarRange: (input: LaborCalendarRangeInput) => Promise<LaborCalendarRange>;
  getHistory: (input: LaborHistoryInput) => Promise<LaborHistory>;
  getJobDetail: (jobId: string) => Promise<LaborJobDetail | null>;
  getPersonDetail: (personId: string) => Promise<LaborPersonDetail | null>;
  workers: {
    list: (options?: { includeArchived?: boolean }) => Promise<LaborWorker[]>;
    create: (input: LaborWorkerInput) => Promise<string>;
    update: (workerId: string, input: UpdateLaborWorkerInput) => Promise<void>;
    archive: (workerId: string, reason: string) => Promise<void>;
  };
  /** Native preview writes through the same ledger commands. Web preview is deliberately read-only. */
  commands: {
    createNormalWork: (input: CreateNormalWorkInput) => Promise<{ jobId: string; payableIds: string[] }>;
    createGroupPieceWork: (input: CreateGroupPieceWorkInput) => Promise<{ jobId: string; settlementGroupId: string }>;
    recordLaborWorkItems: (input: RecordLaborWorkItemsInput) => Promise<RecordedLaborWorkItem[]>;
    createLaborContract: (input: CreateLaborContractInput) => Promise<string>;
    createLaborSettlementGroup: (input: CreateLaborSettlementGroupInput) => Promise<string>;
    addLaborContractProgress: (jobId: string, input: AddContractProgressInput) => Promise<string>;
    completeLaborContractWork: (jobId: string, input: CompleteLaborContractWorkInput) => Promise<string>;
    postLaborPayment: (input: PostLaborPaymentInput) => Promise<string>;
    postLaborSettlementGroupReceipt: (input: PostLaborSettlementGroupReceiptInput) => Promise<string>;
    createLaborWorkerAdvance: (input: CreateLaborWorkerAdvanceInput) => Promise<string>;
    applyLaborAdvanceDeduction: (input: ApplyLaborAdvanceDeductionInput) => Promise<string>;
    editLaborPayment: (paymentId: string, input: EditLaborPaymentInput) => Promise<void>;
    editLaborSettlementGroupReceipt: (receiptId: string, input: EditLaborSettlementGroupReceiptInput) => Promise<void>;
    editLaborWorkerAdvance: (advanceId: string, input: EditLaborWorkerAdvanceInput) => Promise<void>;
  };
};

/** Timeline UUIDs are audit implementation details; preview gives them stable display IDs. */
export const normalizeLaborPreviewReadModel = (model: LaborMvpReadModel): LaborMvpReadModel => ({
  ...model,
  timeline: [...model.timeline]
    .sort((left, right) => `${left.occurredAt}|${left.entityType}|${left.entityId}|${left.action}`.localeCompare(`${right.occurredAt}|${right.entityType}|${right.entityId}|${right.action}`))
    .map((event, index) => ({ ...event, id: `labor-preview-timeline-${index + 1}` })),
});

const hasFixture = async (db: SqlExecutor): Promise<boolean> => {
  const workers = await listLaborWorkers(db, true);
  return workers.some((worker) => worker.id === LABOR_PREVIEW_FIXTURE.people.suda.id);
};

/** Shared native/web fixture: every fact is written through the Labor repository. */
export const seedLaborPreviewFixture = async (db: SqlExecutor): Promise<LaborMvpReadModel> => {
  if (await hasFixture(db)) return getLaborMvpReadModel(db);

  const { people } = LABOR_PREVIEW_FIXTURE;
  await createLaborWorker(db, people.suda, '2026-08-02T08:00:00.000Z');
  await createLaborWorker(db, people.phuang, '2026-08-02T08:00:01.000Z');
  await createLaborWorker(db, people.chon, '2026-08-02T08:00:02.000Z');

  const daily = await createNormalWork(db, {
    id: 'labor-preview-daily',
    title: 'ตัดหญ้ารอบบ้าน',
    workDate: '2026-08-02',
    participants: [{ personId: people.suda.id, payType: 'daily', dueSatang: 35_000, rateSatang: 35_000, quantityMilli: 1_000, unitLabel: 'วัน' }],
  }, '2026-08-02T08:01:00.000Z');
  await postLaborPayment(db, {
    id: 'labor-preview-daily-payment',
    personId: people.suda.id,
    paymentDate: '2026-08-02',
    method: 'cash',
    allocations: [{ payableId: daily.payableIds[0]!, amountSatang: 35_000 }],
  }, '2026-08-02T08:01:01.000Z');

  const group = await createGroupPieceWork(db, {
    id: 'labor-preview-group-piece',
    settlementGroupId: 'labor-preview-group-piece-settlement',
    title: 'กรอกถุงเพาะชำ',
    workDate: '2026-08-01',
    memberPersonIds: [people.suda.id, people.phuang.id],
    quantityMilli: 4_125_000,
    rateSatang: 100,
    unitLabel: 'ถุง',
    collectorLabel: 'พี่สุรับแทนชุดงาน',
  }, '2026-08-02T08:02:00.000Z');
  await postLaborSettlementGroupReceipt(db, {
    id: 'labor-preview-group-receipt',
    settlementGroupId: group.settlementGroupId,
    receiptDate: '2026-08-02',
    amountSatang: 412_500,
    method: 'cash',
  }, '2026-08-02T08:02:01.000Z');

  await createLaborWorkerAdvance(db, {
    id: 'labor-preview-chon-advance',
    personId: people.chon.id,
    advanceDate: '2026-08-01',
    amountSatang: 100_000,
    method: 'cash',
    note: 'ตัวอย่างเงินเบิก',
  }, '2026-08-02T08:03:00.000Z');

  return getLaborMvpReadModel(db);
};

/** Real notebook boundary: migrations may run, but this adapter never seeds proof records. */
export const createLaborNotebookAdapter = (db: SqlExecutor): LaborPreviewAdapter => ({
  mode: 'notebook',
  platform: 'native-notebook',
  getReadModel: () => getLaborMvpReadModel(db),
  getTodaySummary: (date) => getLaborTodaySummary(db, date),
  getCalendarRange: (input) => getLaborCalendarRange(db, input),
  getHistory: (input) => getLaborHistory(db, input),
  getJobDetail: (jobId) => getLaborJobDetail(db, jobId),
  getPersonDetail: (personId) => getLaborPersonDetail(db, personId),
  workers: {
    list: ({ includeArchived = false } = {}) => listLaborWorkers(db, includeArchived),
    create: (input) => createLaborWorker(db, input),
    update: (workerId, input) => updateLaborWorker(db, workerId, input),
    archive: (workerId, reason) => archiveLaborWorker(db, workerId, reason),
  },
  commands: {
    createNormalWork: (input) => createNormalWork(db, input),
    createGroupPieceWork: (input) => createGroupPieceWork(db, input),
    recordLaborWorkItems: (input) => recordLaborWorkItems(db, input),
    createLaborContract: (input) => createLaborContract(db, input),
    createLaborSettlementGroup: (input) => createLaborSettlementGroup(db, input),
    addLaborContractProgress: (jobId, input) => addLaborContractProgress(db, jobId, input),
    completeLaborContractWork: (jobId, input) => completeLaborContractWork(db, jobId, input),
    postLaborPayment: (input) => postLaborPayment(db, input),
    postLaborSettlementGroupReceipt: (input) => postLaborSettlementGroupReceipt(db, input),
    createLaborWorkerAdvance: (input) => createLaborWorkerAdvance(db, input),
    applyLaborAdvanceDeduction: (input) => applyLaborAdvanceDeduction(db, input),
    editLaborPayment: (paymentId, input) => editLaborPayment(db, paymentId, input),
    editLaborSettlementGroupReceipt: (receiptId, input) => editLaborSettlementGroupReceipt(db, receiptId, input),
    editLaborWorkerAdvance: (advanceId, input) => editLaborWorkerAdvance(db, advanceId, input),
  },
});

export const createLaborPreviewAdapter = async (
  db: SqlExecutor,
  platform: 'native-preview' | 'web-preview',
): Promise<LaborPreviewAdapter> => {
  await seedLaborPreviewFixture(db);
  return {
    ...createLaborNotebookAdapter(db),
    mode: 'proof',
    platform,
    label: 'ข้อมูลทดสอบ',
    fixtureVersion: LABOR_PREVIEW_FIXTURE.version,
    getReadModel: async () => normalizeLaborPreviewReadModel(await getLaborMvpReadModel(db)),
    getTodaySummary: (date) => getLaborTodaySummary(db, date),
    getCalendarRange: (input) => getLaborCalendarRange(db, input),
    getHistory: (input) => getLaborHistory(db, input),
    getJobDetail: (jobId) => getLaborJobDetail(db, jobId),
    getPersonDetail: (personId) => getLaborPersonDetail(db, personId),
    commands: {
      createNormalWork: (input) => createNormalWork(db, input),
      createGroupPieceWork: (input) => createGroupPieceWork(db, input),
      recordLaborWorkItems: (input) => recordLaborWorkItems(db, input),
      createLaborContract: (input) => createLaborContract(db, input),
      createLaborSettlementGroup: (input) => createLaborSettlementGroup(db, input),
      addLaborContractProgress: (jobId, input) => addLaborContractProgress(db, jobId, input),
      completeLaborContractWork: (jobId, input) => completeLaborContractWork(db, jobId, input),
      postLaborPayment: (input) => postLaborPayment(db, input),
      postLaborSettlementGroupReceipt: (input) => postLaborSettlementGroupReceipt(db, input),
      createLaborWorkerAdvance: (input) => createLaborWorkerAdvance(db, input),
      applyLaborAdvanceDeduction: (input) => applyLaborAdvanceDeduction(db, input),
      editLaborPayment: (paymentId, input) => editLaborPayment(db, paymentId, input),
      editLaborSettlementGroupReceipt: (receiptId, input) => editLaborSettlementGroupReceipt(db, receiptId, input),
      editLaborWorkerAdvance: (advanceId, input) => editLaborWorkerAdvance(db, advanceId, input),
    },
  };
};
