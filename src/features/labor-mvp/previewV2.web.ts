import { LABOR_V2_PREVIEW_WEB_FIXTURE } from './previewV2.web.fixture';
import type { LaborV2Adapter } from './previewV2Adapter';
import { reconcileLaborV2PaymentBatchDraft } from './repositoryV2';
import type { LaborV2MoneyHistory, LaborV2PersonDetail, LaborV2ReadModel } from './types';

const empty = (): LaborV2ReadModel => ({ sourceVersion: 'v2', tasks: [], obligations: [], payments: [], events: [] });
const fixtureWorkers = [
  { id: 'labor-v2-preview-su', displayName: 'พี่สุ', specialty: 'งานรายวัน', phone: '', note: '', archivedAt: null },
  { id: 'labor-v2-preview-phuang', displayName: 'พี่พวง', specialty: 'กรอกถุงเพาะชำ', phone: '', note: '', archivedAt: null },
  { id: 'labor-v2-preview-chon', displayName: 'น้าชล', specialty: 'งานรายชั่วโมง', phone: '', note: '', archivedAt: null },
];
const readonly = async (): Promise<never> => { throw new Error('การบันทึกจากเว็บยังไม่รองรับ กรุณาเปิดแอปบนอุปกรณ์เพื่อบันทึกข้อมูล'); };
const detail = (model: LaborV2ReadModel, taskId: string) => { const task = model.tasks.find((item) => item.id === taskId); if (!task) throw new Error('ไม่พบงาน'); return { ...task, wageContexts: [] }; };
const emptyMoneyHistory = (model: LaborV2ReadModel): LaborV2MoneyHistory => ({ sourceVersion: 'v2', payments: model.payments, advances: [], events: [], entries: model.payments.map((payment) => ({ kind: 'payment', id: payment.id, effectiveDate: payment.paymentDate, cashPaidSatang: payment.cashPaidSatang, payment })) });
const fallbackPersonDetail = (model: LaborV2ReadModel, personId: string): LaborV2PersonDetail => ({ sourceVersion: 'v2', personId, tasks: model.tasks.filter((item) => item.assigneePersonIds.includes(personId)), obligations: model.obligations.filter((item) => item.personId === personId), payments: [], advances: [], events: model.events.filter((item) => item.entityId === personId) });
const adapter = (model: LaborV2ReadModel, mode: 'notebook' | 'proof', staticRead?: Pick<typeof LABOR_V2_PREVIEW_WEB_FIXTURE, 'paymentBatchItems' | 'moneyHistory' | 'personDetails'>): LaborV2Adapter => ({
  mode,
  sourceVersion: 'v2',
  ...(mode === 'proof' ? { label: 'ข้อมูลทดสอบ' as const } : {}),
  getReadModel: async () => structuredClone(model),
  getToday: async (date) => ({ sourceVersion: 'v2', date, tasks: model.tasks.filter((item) => item.workDate === date).slice(0, 5).map((item) => detail(model, item.id)), unpaid: model.obligations.filter((item) => item.remainingSatang > 0).slice(0, 5) }),
  getCalendar: async (startDate, endDate) => ({ sourceVersion: 'v2', days: [...new Map(model.tasks.filter((item) => item.workDate >= startDate && item.workDate <= endDate).map((item) => [item.workDate, { workDate: item.workDate, taskCount: model.tasks.filter((task) => task.workDate === item.workDate).length, taskIds: model.tasks.filter((task) => task.workDate === item.workDate).map((task) => task.id) }])).values()] }),
  getCalendarMonth: async (month) => { const count = new Date(`${month}-01T00:00:00.000Z`); const days = new Date(Date.UTC(count.getUTCFullYear(), count.getUTCMonth() + 1, 0)).getUTCDate(); const calendar = await adapter(model, mode, staticRead).getCalendar(`${month}-01`, `${month}-${String(days).padStart(2, '0')}`); const index = new Map(calendar.days.map((item) => [item.workDate, item])); return { sourceVersion: 'v2' as const, month, days: Array.from({ length: days }, (_, position) => { const workDate = `${month}-${String(position + 1).padStart(2, '0')}`; return { workDate, taskCount: index.get(workDate)?.taskCount ?? 0, taskIds: index.get(workDate)?.taskIds ?? [], isInMonth: true as const }; }) }; },
  getWorkList: async (filters = {}, cursor, limit = 50) => { const marker = cursor ? JSON.parse(decodeURIComponent(cursor)) : null; const rows = model.tasks.filter((item) => (!filters.startDate || item.workDate >= filters.startDate) && (!filters.endDate || item.workDate <= filters.endDate) && (!filters.personId || item.assigneePersonIds.includes(filters.personId)) && (!marker || item.workDate < marker.workDate || (item.workDate === marker.workDate && item.id > marker.id))).map((item) => detail(model, item.id)); const items = rows.slice(0, limit); return { sourceVersion: 'v2' as const, items, nextCursor: rows.length > items.length ? encodeURIComponent(JSON.stringify({ workDate: items.at(-1)?.workDate, id: items.at(-1)?.id })) : null }; },
  getTaskDetail: async (taskId) => detail(model, taskId),
  getPersonDetail: async (personId) => structuredClone(staticRead?.personDetails[personId] ?? fallbackPersonDetail(model, personId)),
  legacyRead: async () => ({ sourceVersion: 'v1', sourceLabel: 'ประวัติเดิม (V1, อ่านอย่างเดียว)', jobs: [] }),
  getHistory: async () => structuredClone(model.events),
  getPerson: async (personId) => { const person = staticRead?.personDetails[personId] ?? fallbackPersonDetail(model, personId); return structuredClone({ sourceVersion: 'v2' as const, personId, tasks: person.tasks, obligations: person.obligations, payments: person.payments, events: person.events }); },
  getUnpaid: async () => structuredClone(model.obligations.filter((item) => item.remainingSatang > 0)),
  getMoneyHistory: async () => structuredClone(staticRead?.moneyHistory ?? emptyMoneyHistory(model)),
  getPaymentBatchDraft: async (input = {}) => reconcileLaborV2PaymentBatchDraft(staticRead?.paymentBatchItems ?? [], input),
  workers: { list: async (includeArchived = false) => mode === 'proof' ? structuredClone(fixtureWorkers.filter((item) => includeArchived || !item.archivedAt)) : [], create: readonly, update: readonly, archive: readonly },
  contracts: { listOpen: async () => [] },
  personFinance: { listAdvances: async () => [], issueAdvance: readonly },
  commands: { recordDay: readonly, startContract: readonly, progressContract: readonly, finalizeContract: readonly, postPayment: readonly, correctPayment: readonly },
});
export const createWebLaborV2PreviewAdapter = (): LaborV2Adapter => adapter(LABOR_V2_PREVIEW_WEB_FIXTURE.readModel, 'proof', LABOR_V2_PREVIEW_WEB_FIXTURE);
export const createWebLaborV2NotebookAdapter = (): LaborV2Adapter => adapter(empty(), 'notebook');
