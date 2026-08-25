import type { SqlExecutor } from '../../data/migrations';
import { archiveLaborWorker, createLaborWorker, listLaborWorkers, updateLaborWorker } from './repository';
import { archiveLaborV2Chemical, archiveLaborV2Plot, correctLaborV2PaymentSession, createLaborV2Chemical, createLaborV2PersonAdvance, createLaborV2Plot, finalizeLaborContractBatchV2, getCalendarMonthV2, getLaborV2Calendar, getLaborV2ChemicalDetail, getLaborV2History, getLaborV2MoneyHistory, getLaborV2PaymentBatchDraft, getLaborV2Person, getLaborV2PlotDetail, getLaborV2ReadModel, getLaborV2Today, getLaborV2Unpaid, getLegacyLaborRead, getPersonDetailV2, getTaskDetailV2, getWorkListV2, listLaborV2Chemicals, listLaborV2PersonAdvances, listLaborV2Plots, listOpenLaborContractBatchesV2, markLaborV2ChemicalEmpty, postLaborV2PaymentSession, recordLaborDayV2, recordLaborContractProgressV2, restoreLaborV2Chemical, restoreLaborV2ChemicalAvailable, restoreLaborV2Plot, startLaborContractBatchV2, updateLaborV2Chemical, updateLaborV2Plot } from './repositoryV2';
import type { CorrectLaborV2PaymentSessionInput, CreateLaborV2ChemicalInput, CreateLaborV2PlotInput, CreateLaborWorkerAdvanceInput, FinalizeLaborContractBatchV2Input, LaborV2PaymentBatchDraftInput, LaborV2ReadModel, LaborV2WorkListFilters, PostLaborV2PaymentSessionInput, RecordLaborContractProgressV2Input, RecordLaborDayV2Input, StartLaborContractBatchV2Input, UpdateLaborV2ChemicalInput, UpdateLaborV2PlotInput, UpdateLaborWorkerInput, LaborWorkerInput } from './types';

export type LaborV2Adapter = {
  mode: 'notebook' | 'proof';
  sourceVersion: 'v2';
  label?: 'ข้อมูลทดสอบ';
  getReadModel: () => Promise<LaborV2ReadModel>;
  getToday: (date: string) => ReturnType<typeof getLaborV2Today>;
  getCalendar: (startDate: string, endDate: string) => ReturnType<typeof getLaborV2Calendar>;
  getHistory: () => ReturnType<typeof getLaborV2History>;
  getPerson: (personId: string) => ReturnType<typeof getLaborV2Person>;
  getCalendarMonth: (month: string) => ReturnType<typeof getCalendarMonthV2>;
  getWorkList: (filters?: LaborV2WorkListFilters, cursor?: string, limit?: number) => ReturnType<typeof getWorkListV2>;
  getTaskDetail: (taskId: string) => ReturnType<typeof getTaskDetailV2>;
  getPersonDetail: (personId: string) => ReturnType<typeof getPersonDetailV2>;
  legacyRead: () => ReturnType<typeof getLegacyLaborRead>;
  getUnpaid: () => ReturnType<typeof getLaborV2Unpaid>;
  getMoneyHistory: () => ReturnType<typeof getLaborV2MoneyHistory>;
  getPaymentBatchDraft: (input?: LaborV2PaymentBatchDraftInput) => ReturnType<typeof getLaborV2PaymentBatchDraft>;
  workers: { list: (includeArchived?: boolean) => ReturnType<typeof listLaborWorkers>; create: (input: LaborWorkerInput) => Promise<string>; update: (id: string, input: UpdateLaborWorkerInput) => Promise<void>; archive: (id: string, reason: string) => Promise<void> };
  /** Plot master stays route-local V2 context; it never changes compensation semantics. */
  plots: { list: (includeArchived?: boolean) => ReturnType<typeof listLaborV2Plots>; detail: (plotId: string) => ReturnType<typeof getLaborV2PlotDetail>; create: (input: CreateLaborV2PlotInput) => Promise<string>; update: (plotId: string, input: UpdateLaborV2PlotInput) => Promise<void>; archive: (plotId: string, reason: string) => Promise<void>; restore: (plotId: string, reason: string) => Promise<void> };
  /** Chemical library is V2-only master data; it is not stock counting and does not revive V1 materials. */
  chemicals: { list: (includeArchived?: boolean) => ReturnType<typeof listLaborV2Chemicals>; detail: (chemicalId: string) => ReturnType<typeof getLaborV2ChemicalDetail>; create: (input: CreateLaborV2ChemicalInput) => Promise<string>; update: (chemicalId: string, input: UpdateLaborV2ChemicalInput) => Promise<void>; markEmpty: (chemicalId: string, reason: string) => Promise<void>; restoreAvailable: (chemicalId: string, reason: string) => Promise<void>; archive: (chemicalId: string, reason: string) => Promise<void>; restore: (chemicalId: string, reason: string) => Promise<void> };
  contracts: { listOpen: () => ReturnType<typeof listOpenLaborContractBatchesV2> };
  personFinance: { listAdvances: (personId?: string) => ReturnType<typeof listLaborV2PersonAdvances>; issueAdvance: (input: CreateLaborWorkerAdvanceInput) => ReturnType<typeof createLaborV2PersonAdvance> };
  commands: { recordDay: (input: RecordLaborDayV2Input) => ReturnType<typeof recordLaborDayV2>; startContract: (input: StartLaborContractBatchV2Input) => ReturnType<typeof startLaborContractBatchV2>; progressContract: (id: string, input: RecordLaborContractProgressV2Input) => ReturnType<typeof recordLaborContractProgressV2>; finalizeContract: (id: string, input: FinalizeLaborContractBatchV2Input) => ReturnType<typeof finalizeLaborContractBatchV2>; postPayment: (input: PostLaborV2PaymentSessionInput) => ReturnType<typeof postLaborV2PaymentSession>; correctPayment: (id: string, input: CorrectLaborV2PaymentSessionInput) => ReturnType<typeof correctLaborV2PaymentSession> };
};

export const createLaborV2NotebookAdapter = (db: SqlExecutor): LaborV2Adapter => ({
  mode: 'notebook', sourceVersion: 'v2', getReadModel: () => getLaborV2ReadModel(db), getToday: (date) => getLaborV2Today(db, date), getCalendar: (start, end) => getLaborV2Calendar(db, start, end), getCalendarMonth: (month) => getCalendarMonthV2(db, month), getWorkList: (filters, cursor, limit) => getWorkListV2(db, filters, cursor, limit), getTaskDetail: (id) => getTaskDetailV2(db, id), getPersonDetail: (id) => getPersonDetailV2(db, id), legacyRead: () => getLegacyLaborRead(db), getHistory: () => getLaborV2History(db), getPerson: (id) => getLaborV2Person(db, id), getUnpaid: () => getLaborV2Unpaid(db), getMoneyHistory: () => getLaborV2MoneyHistory(db), getPaymentBatchDraft: (input) => getLaborV2PaymentBatchDraft(db, input),
  workers: { list: (includeArchived = false) => listLaborWorkers(db, includeArchived), create: (input) => createLaborWorker(db, input), update: (id, input) => updateLaborWorker(db, id, input), archive: (id, reason) => archiveLaborWorker(db, id, reason) },
  plots: { list: (includeArchived = false) => listLaborV2Plots(db, includeArchived), detail: (id) => getLaborV2PlotDetail(db, id), create: (input) => createLaborV2Plot(db, input), update: (id, input) => updateLaborV2Plot(db, id, input), archive: (id, reason) => archiveLaborV2Plot(db, id, reason), restore: (id, reason) => restoreLaborV2Plot(db, id, reason) },
  chemicals: { list: (includeArchived = false) => listLaborV2Chemicals(db, includeArchived), detail: (id) => getLaborV2ChemicalDetail(db, id), create: (input) => createLaborV2Chemical(db, input), update: (id, input) => updateLaborV2Chemical(db, id, input), markEmpty: (id, reason) => markLaborV2ChemicalEmpty(db, id, reason), restoreAvailable: (id, reason) => restoreLaborV2ChemicalAvailable(db, id, reason), archive: (id, reason) => archiveLaborV2Chemical(db, id, reason), restore: (id, reason) => restoreLaborV2Chemical(db, id, reason) },
  contracts: { listOpen: () => listOpenLaborContractBatchesV2(db) }, personFinance: { listAdvances: (personId) => listLaborV2PersonAdvances(db, personId), issueAdvance: (input) => createLaborV2PersonAdvance(db, input) },
  commands: { recordDay: (input) => recordLaborDayV2(db, input), startContract: (input) => startLaborContractBatchV2(db, input), progressContract: (id, input) => recordLaborContractProgressV2(db, id, input), finalizeContract: (id, input) => finalizeLaborContractBatchV2(db, id, input), postPayment: (input) => postLaborV2PaymentSession(db, input), correctPayment: (id, input) => correctLaborV2PaymentSession(db, id, input) },
});
