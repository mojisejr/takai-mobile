import type { SqlExecutor } from '../../data/migrations';
import { archiveLaborWorker, createLaborWorker, listLaborWorkers, updateLaborWorker } from './repository';
import { correctLaborV2PaymentSession, createLaborV2PersonAdvance, finalizeLaborContractBatchV2, getLaborV2Calendar, getLaborV2History, getLaborV2MoneyHistory, getLaborV2Person, getLaborV2ReadModel, getLaborV2Today, getLaborV2Unpaid, listLaborV2PersonAdvances, listOpenLaborContractBatchesV2, postLaborV2PaymentSession, recordLaborDayV2, recordLaborContractProgressV2, startLaborContractBatchV2 } from './repositoryV2';
import type { CorrectLaborV2PaymentSessionInput, CreateLaborWorkerAdvanceInput, FinalizeLaborContractBatchV2Input, LaborV2ReadModel, PostLaborV2PaymentSessionInput, RecordLaborContractProgressV2Input, RecordLaborDayV2Input, StartLaborContractBatchV2Input, UpdateLaborWorkerInput, LaborWorkerInput } from './types';

export type LaborV2Adapter = {
  mode: 'notebook' | 'proof';
  sourceVersion: 'v2';
  label?: 'ข้อมูลทดสอบ';
  getReadModel: () => Promise<LaborV2ReadModel>;
  getToday: (date: string) => ReturnType<typeof getLaborV2Today>;
  getCalendar: (startDate: string, endDate: string) => ReturnType<typeof getLaborV2Calendar>;
  getHistory: () => ReturnType<typeof getLaborV2History>;
  getPerson: (personId: string) => ReturnType<typeof getLaborV2Person>;
  getUnpaid: () => ReturnType<typeof getLaborV2Unpaid>;
  getMoneyHistory: () => ReturnType<typeof getLaborV2MoneyHistory>;
  workers: { list: (includeArchived?: boolean) => ReturnType<typeof listLaborWorkers>; create: (input: LaborWorkerInput) => Promise<string>; update: (id: string, input: UpdateLaborWorkerInput) => Promise<void>; archive: (id: string, reason: string) => Promise<void> };
  contracts: { listOpen: () => ReturnType<typeof listOpenLaborContractBatchesV2> };
  personFinance: { listAdvances: (personId?: string) => ReturnType<typeof listLaborV2PersonAdvances>; issueAdvance: (input: CreateLaborWorkerAdvanceInput) => ReturnType<typeof createLaborV2PersonAdvance> };
  commands: { recordDay: (input: RecordLaborDayV2Input) => ReturnType<typeof recordLaborDayV2>; startContract: (input: StartLaborContractBatchV2Input) => ReturnType<typeof startLaborContractBatchV2>; progressContract: (id: string, input: RecordLaborContractProgressV2Input) => ReturnType<typeof recordLaborContractProgressV2>; finalizeContract: (id: string, input: FinalizeLaborContractBatchV2Input) => ReturnType<typeof finalizeLaborContractBatchV2>; postPayment: (input: PostLaborV2PaymentSessionInput) => ReturnType<typeof postLaborV2PaymentSession>; correctPayment: (id: string, input: CorrectLaborV2PaymentSessionInput) => ReturnType<typeof correctLaborV2PaymentSession> };
};

export const createLaborV2NotebookAdapter = (db: SqlExecutor): LaborV2Adapter => ({
  mode: 'notebook', sourceVersion: 'v2', getReadModel: () => getLaborV2ReadModel(db), getToday: (date) => getLaborV2Today(db, date), getCalendar: (start, end) => getLaborV2Calendar(db, start, end), getHistory: () => getLaborV2History(db), getPerson: (id) => getLaborV2Person(db, id), getUnpaid: () => getLaborV2Unpaid(db), getMoneyHistory: () => getLaborV2MoneyHistory(db),
  workers: { list: (includeArchived = false) => listLaborWorkers(db, includeArchived), create: (input) => createLaborWorker(db, input), update: (id, input) => updateLaborWorker(db, id, input), archive: (id, reason) => archiveLaborWorker(db, id, reason) },
  contracts: { listOpen: () => listOpenLaborContractBatchesV2(db) }, personFinance: { listAdvances: (personId) => listLaborV2PersonAdvances(db, personId), issueAdvance: (input) => createLaborV2PersonAdvance(db, input) },
  commands: { recordDay: (input) => recordLaborDayV2(db, input), startContract: (input) => startLaborContractBatchV2(db, input), progressContract: (id, input) => recordLaborContractProgressV2(db, id, input), finalizeContract: (id, input) => finalizeLaborContractBatchV2(db, id, input), postPayment: (input) => postLaborV2PaymentSession(db, input), correctPayment: (id, input) => correctLaborV2PaymentSession(db, id, input) },
});
