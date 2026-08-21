import { LABOR_V2_PREVIEW_WEB_FIXTURE } from './previewV2.web.fixture';
import type { LaborV2Adapter } from './previewV2Adapter';
import type { LaborV2ReadModel } from './types';

const empty = (): LaborV2ReadModel => ({ sourceVersion: 'v2', tasks: [], obligations: [], payments: [], events: [] });
const fixtureWorkers = [
  { id: 'labor-v2-preview-su', displayName: 'พี่สุ', specialty: 'งานรายวัน', phone: '', note: '', archivedAt: null },
  { id: 'labor-v2-preview-phuang', displayName: 'พี่พวง', specialty: 'กรอกถุงเพาะชำ', phone: '', note: '', archivedAt: null },
  { id: 'labor-v2-preview-chon', displayName: 'น้าชล', specialty: 'งานรายชั่วโมง', phone: '', note: '', archivedAt: null },
];
const readonly = async (): Promise<never> => { throw new Error('การบันทึกจากเว็บยังไม่รองรับ กรุณาเปิดแอปบนอุปกรณ์เพื่อบันทึกข้อมูล'); };
const adapter = (model: LaborV2ReadModel, mode: 'notebook' | 'proof'): LaborV2Adapter => ({
  mode, sourceVersion: 'v2', ...(mode === 'proof' ? { label: 'ข้อมูลทดสอบ' as const } : {}), getReadModel: async () => structuredClone(model), getToday: async (date) => ({ sourceVersion: 'v2', date, tasks: model.tasks.filter((item) => item.workDate === date), unpaid: model.obligations.filter((item) => item.remainingSatang > 0) }), getCalendar: async (startDate, endDate) => ({ sourceVersion: 'v2', days: [...new Map(model.tasks.filter((item) => item.workDate >= startDate && item.workDate <= endDate).map((item) => [item.workDate, { workDate: item.workDate, taskCount: model.tasks.filter((task) => task.workDate === item.workDate).length, taskIds: model.tasks.filter((task) => task.workDate === item.workDate).map((task) => task.id) }])).values()] }), getHistory: async () => model.events, getPerson: async (personId) => ({ sourceVersion: 'v2', personId, tasks: model.tasks.filter((task) => task.assigneePersonIds.includes(personId)), obligations: model.obligations.filter((item) => item.personId === personId), payments: model.payments, events: model.events.filter((item) => item.entityId === personId || item.entityType === 'payment_session') }), getUnpaid: async () => model.obligations.filter((item) => item.remainingSatang > 0), getMoneyHistory: async () => model.payments,
  workers: { list: async (includeArchived = false) => mode === 'proof' ? structuredClone(fixtureWorkers.filter((item) => includeArchived || !item.archivedAt)) : [], create: readonly, update: readonly, archive: readonly }, contracts: { listOpen: async () => [] }, personFinance: { listAdvances: async () => [], issueAdvance: readonly }, commands: { recordDay: readonly, startContract: readonly, progressContract: readonly, finalizeContract: readonly, postPayment: readonly, correctPayment: readonly },
});
export const createWebLaborV2PreviewAdapter = (): LaborV2Adapter => adapter(LABOR_V2_PREVIEW_WEB_FIXTURE.readModel, 'proof');
export const createWebLaborV2NotebookAdapter = (): LaborV2Adapter => adapter(empty(), 'notebook');
