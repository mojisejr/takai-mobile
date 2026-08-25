import type { SqlExecutor } from '../../data/migrations';
import { planLaborCompensationV2 } from './compensationV2';
import { createLaborWorkerAdvance, listLaborWorkerAdvances } from './repository';
import type { CorrectLaborV2PaymentSessionInput, CreateLaborV2ChemicalInput, CreateLaborV2PlotInput, CreateLaborWorkerAdvanceInput, FinalizeLaborContractBatchV2Input, LaborV2CalendarDay, LaborV2CalendarMonth, LaborV2Chemical, LaborV2ChemicalDetail, LaborV2ChemicalRevision, LaborV2ChemicalStatus, LaborV2MoneyHistory, LaborV2OpenContractBatch, LaborV2PaymentBatchDraft, LaborV2PaymentBatchDraftInput, LaborV2PaymentBatchDraftItem, LaborV2PersonDetail, LaborV2PersonProjection, LaborV2Plot, LaborV2PlotDetail, LaborV2PlotRevision, LaborV2ReadModel, LaborV2TaskDetail, LaborV2TaskWageContext, LaborV2TodayProjection, LaborV2WorkList, LaborV2WorkListFilters, LaborWorkerAdvance, LegacyLaborRead, PostLaborV2PaymentSessionInput, RecordLaborContractProgressV2Input, RecordLaborDayV2Input, StartLaborContractBatchV2Input, UpdateLaborV2ChemicalInput, UpdateLaborV2PlotInput } from './types';

const now = (): string => new Date().toISOString();
const id = (prefix: string): string => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const text = (value: string | undefined): string => (value ?? '').trim();
const date = (value: string, label: string): void => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`TAKAI V2 ${label} must be YYYY-MM-DD`); };
const positive = (value: number, label: string): void => { if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`TAKAI V2 ${label} must be a positive whole-satang integer`); };
const transaction = async <T>(db: SqlExecutor, work: () => Promise<T>): Promise<T> => { await db.execAsync('BEGIN IMMEDIATE'); try { const result = await work(); await db.execAsync('COMMIT'); return result; } catch (error) { await db.execAsync('ROLLBACK'); throw error; } };
const event = async (db: SqlExecutor, input: { entityType: string; entityId: string; action: string; occurredAt: string; reason?: string | null; before?: unknown; after: unknown }): Promise<void> => {
  await db.runAsync('INSERT INTO labor_v2_event_history (id, entity_type, entity_id, action, reason, before_json, after_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id('labor-v2-event'), input.entityType, input.entityId, input.action, input.reason ?? null, input.before === undefined ? null : JSON.stringify(input.before), JSON.stringify(input.after), input.occurredAt]);
};
const worker = async (db: SqlExecutor, personId: string): Promise<void> => {
  const rows = await db.getAllAsync<{ id: string }>("SELECT id FROM people WHERE id = ? AND role = 'worker' AND is_self = 0 AND archived_at IS NULL", [personId]);
  if (!rows[0]) throw new Error(`TAKAI V2 worker is unavailable: ${personId}`);
};

type PlotRow = { id: string; name: string; crop_label: string; latitude: number | null; longitude: number | null; archived_at: string | null; current_revision: number; created_at: string; updated_at: string };
type PlotRevisionRow = { id: string; plot_id: string; revision: number; action: LaborV2PlotRevision['action']; reason: string | null; before_json: string | null; after_json: string; created_at: string };
type TaskPlotTargetRow = { id: string; task_id: string; plot_id: string; plot_name_snapshot: string; sort_order: number; current_name: string };
type TaskPlotTreeRefRow = { task_plot_target_id: string; tree_label: string; sort_order: number };
type ChemicalRow = { id: string; common_name: string; brand_name: string; chemical_group: string; detail: string; reference_amount: number; reference_unit: string; reference_water_litres: number; added_on: string; status: LaborV2ChemicalStatus; archived_at: string | null; current_revision: number; created_at: string; updated_at: string };
type ChemicalRevisionRow = { id: string; chemical_id: string; revision: number; action: LaborV2ChemicalRevision['action']; reason: string | null; before_json: string | null; after_json: string; created_at: string };
const plotSnapshot = (row: PlotRow): LaborV2Plot => ({ id: row.id, name: row.name, cropLabel: row.crop_label, latitude: row.latitude === null ? null : Number(row.latitude), longitude: row.longitude === null ? null : Number(row.longitude), archivedAt: row.archived_at, currentRevision: Number(row.current_revision), createdAt: row.created_at, updatedAt: row.updated_at });
const coordinates = (latitude: number | null | undefined, longitude: number | null | undefined): { latitude: number | null; longitude: number | null } => { const lat = latitude ?? null; const lon = longitude ?? null; if ((lat === null) !== (lon === null)) throw new Error('TAKAI V2 plot coordinates require both latitude and longitude'); if (lat !== null && (!Number.isFinite(lat) || !Number.isFinite(lon!) || lat < -90 || lat > 90 || lon! < -180 || lon! > 180)) throw new Error('TAKAI V2 plot coordinates are out of range'); return { latitude: lat, longitude: lon }; };
const requiredReason = (value: string | undefined, action: string): string => { const reason = text(value); if (!reason) throw new Error(`TAKAI V2 plot ${action} requires a reason`); return reason; };
const activePlots = async (db: SqlExecutor, plotIds: string[]): Promise<Map<string, PlotRow>> => { if (!plotIds.length) return new Map(); const rows = await db.getAllAsync<PlotRow>(`SELECT id, name, crop_label, latitude, longitude, archived_at, current_revision, created_at, updated_at FROM labor_v2_plots WHERE id IN (${plotIds.map(() => '?').join(', ')}) AND archived_at IS NULL`, plotIds); const byId = new Map(rows.map((row) => [row.id, row])); if (byId.size !== plotIds.length) throw new Error('TAKAI V2 plot is unavailable or archived'); return byId; };
const appendPlotRevision = async (db: SqlExecutor, plotId: string, revision: number, action: LaborV2PlotRevision['action'], reason: string | null, before: unknown | undefined, after: unknown, occurredAt: string): Promise<void> => { await db.runAsync('INSERT INTO labor_v2_plot_revisions (id, plot_id, revision, action, reason, before_json, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id('labor-v2-plot-revision'), plotId, revision, action, reason, before === undefined ? null : JSON.stringify(before), JSON.stringify(after), occurredAt]); };
const chemicalSnapshot = (row: ChemicalRow): LaborV2Chemical => ({ id: row.id, commonName: row.common_name, brandName: row.brand_name, chemicalGroup: row.chemical_group, detail: row.detail, referenceAmount: Number(row.reference_amount), referenceUnit: row.reference_unit, referenceWaterLitres: Number(row.reference_water_litres), addedOn: row.added_on, status: row.status, archivedAt: row.archived_at, currentRevision: Number(row.current_revision), createdAt: row.created_at, updatedAt: row.updated_at });
const chemicalDose = (amount: number, unit: string, waterLitres: number): { amount: number; unit: string; waterLitres: number } => { if (!Number.isFinite(amount) || amount <= 0) throw new Error('TAKAI V2 chemical reference amount must be positive'); const normalizedUnit = text(unit); if (!normalizedUnit) throw new Error('TAKAI V2 chemical reference unit is required'); if (!Number.isFinite(waterLitres) || waterLitres <= 0) throw new Error('TAKAI V2 chemical reference water must be positive'); return { amount, unit: normalizedUnit, waterLitres }; };
const appendChemicalRevision = async (db: SqlExecutor, chemicalId: string, revision: number, action: LaborV2ChemicalRevision['action'], reason: string | null, before: unknown | undefined, after: unknown, occurredAt: string): Promise<void> => { await db.runAsync('INSERT INTO labor_v2_chemical_revisions (id, chemical_id, revision, action, reason, before_json, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id('labor-v2-chemical-revision'), chemicalId, revision, action, reason, before === undefined ? null : JSON.stringify(before), JSON.stringify(after), occurredAt]); };

export const createLaborV2Plot = async (db: SqlExecutor, input: CreateLaborV2PlotInput, occurredAt = now()): Promise<string> => transaction(db, async () => { const name = text(input.name); if (!name) throw new Error('TAKAI V2 plot requires a name'); const point = coordinates(input.latitude, input.longitude); const plotId = input.id ?? id('labor-v2-plot'); await db.runAsync('INSERT INTO labor_v2_plots (id, name, crop_label, latitude, longitude, archived_at, current_revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, 1, ?, ?)', [plotId, name, text(input.cropLabel), point.latitude, point.longitude, occurredAt, occurredAt]); const row = (await db.getAllAsync<PlotRow>('SELECT id, name, crop_label, latitude, longitude, archived_at, current_revision, created_at, updated_at FROM labor_v2_plots WHERE id = ?', [plotId]))[0]!; await appendPlotRevision(db, plotId, 1, 'created', null, undefined, plotSnapshot(row), occurredAt); return plotId; });
export const listLaborV2Plots = async (db: SqlExecutor, includeArchived = false): Promise<LaborV2Plot[]> => (await db.getAllAsync<PlotRow>(`SELECT id, name, crop_label, latitude, longitude, archived_at, current_revision, created_at, updated_at FROM labor_v2_plots ${includeArchived ? '' : 'WHERE archived_at IS NULL'} ORDER BY archived_at IS NOT NULL, name COLLATE NOCASE ASC, id ASC`)).map(plotSnapshot);
export const getLaborV2PlotDetail = async (db: SqlExecutor, plotId: string): Promise<LaborV2PlotDetail> => { const row = (await db.getAllAsync<PlotRow>('SELECT id, name, crop_label, latitude, longitude, archived_at, current_revision, created_at, updated_at FROM labor_v2_plots WHERE id = ?', [plotId]))[0]; if (!row) throw new Error('TAKAI V2 plot is unavailable'); const revisions = await db.getAllAsync<PlotRevisionRow>('SELECT id, plot_id, revision, action, reason, before_json, after_json, created_at FROM labor_v2_plot_revisions WHERE plot_id = ? ORDER BY revision DESC', [plotId]); return { ...plotSnapshot(row), revisions: revisions.map((item) => ({ id: item.id, plotId: item.plot_id, revision: Number(item.revision), action: item.action, reason: item.reason, before: item.before_json ? JSON.parse(item.before_json) : null, after: JSON.parse(item.after_json), createdAt: item.created_at })) }; };
export const updateLaborV2Plot = async (db: SqlExecutor, plotId: string, input: UpdateLaborV2PlotInput, occurredAt = now()): Promise<void> => transaction(db, async () => { const reason = requiredReason(input.reason, 'update'); const existing = (await db.getAllAsync<PlotRow>('SELECT id, name, crop_label, latitude, longitude, archived_at, current_revision, created_at, updated_at FROM labor_v2_plots WHERE id = ? AND archived_at IS NULL', [plotId]))[0]; if (!existing) throw new Error('TAKAI V2 active plot is unavailable'); const name = input.name === undefined ? existing.name : text(input.name); if (!name) throw new Error('TAKAI V2 plot requires a name'); const cropLabel = input.cropLabel === undefined ? existing.crop_label : text(input.cropLabel); const point = coordinates(input.latitude === undefined ? existing.latitude : input.latitude, input.longitude === undefined ? existing.longitude : input.longitude); const before = plotSnapshot(existing); const revision = Number(existing.current_revision) + 1; await db.runAsync('UPDATE labor_v2_plots SET name = ?, crop_label = ?, latitude = ?, longitude = ?, current_revision = ?, updated_at = ? WHERE id = ?', [name, cropLabel, point.latitude, point.longitude, revision, occurredAt, plotId]); const after = { ...before, name, cropLabel, latitude: point.latitude, longitude: point.longitude, currentRevision: revision, updatedAt: occurredAt }; await appendPlotRevision(db, plotId, revision, 'updated', reason, before, after, occurredAt); });
const changeLaborV2PlotArchive = async (db: SqlExecutor, plotId: string, action: 'archived' | 'restored', reason: string, occurredAt: string): Promise<void> => transaction(db, async () => { const trimmedReason = requiredReason(reason, action === 'archived' ? 'archive' : 'restore'); const existing = (await db.getAllAsync<PlotRow>('SELECT id, name, crop_label, latitude, longitude, archived_at, current_revision, created_at, updated_at FROM labor_v2_plots WHERE id = ?', [plotId]))[0]; if (!existing) throw new Error('TAKAI V2 plot is unavailable'); if ((action === 'archived') === Boolean(existing.archived_at)) throw new Error(`TAKAI V2 plot is already ${action === 'archived' ? 'archived' : 'active'}`); const before = plotSnapshot(existing); const revision = Number(existing.current_revision) + 1; const archivedAt = action === 'archived' ? occurredAt : null; await db.runAsync('UPDATE labor_v2_plots SET archived_at = ?, current_revision = ?, updated_at = ? WHERE id = ?', [archivedAt, revision, occurredAt, plotId]); const after = { ...before, archivedAt, currentRevision: revision, updatedAt: occurredAt }; await appendPlotRevision(db, plotId, revision, action, trimmedReason, before, after, occurredAt); });
export const archiveLaborV2Plot = (db: SqlExecutor, plotId: string, reason: string, occurredAt = now()): Promise<void> => changeLaborV2PlotArchive(db, plotId, 'archived', reason, occurredAt);
export const restoreLaborV2Plot = (db: SqlExecutor, plotId: string, reason: string, occurredAt = now()): Promise<void> => changeLaborV2PlotArchive(db, plotId, 'restored', reason, occurredAt);

/** V2 chemical master data is additive and never reads/writes retired V1 materials or activity_materials. */
export const createLaborV2Chemical = async (db: SqlExecutor, input: CreateLaborV2ChemicalInput, occurredAt = now()): Promise<string> => transaction(db, async () => {
  const commonName = text(input.commonName); if (!commonName) throw new Error('TAKAI V2 chemical common name is required'); date(input.addedOn, 'chemical added date'); const dose = chemicalDose(input.referenceAmount, input.referenceUnit, input.referenceWaterLitres); const chemicalId = input.id ?? id('labor-v2-chemical');
  await db.runAsync("INSERT INTO labor_v2_chemical_items (id, common_name, brand_name, chemical_group, detail, reference_amount, reference_unit, reference_water_litres, added_on, status, archived_at, current_revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', NULL, 1, ?, ?)", [chemicalId, commonName, text(input.brandName), text(input.chemicalGroup), text(input.detail), dose.amount, dose.unit, dose.waterLitres, input.addedOn, occurredAt, occurredAt]);
  const row = (await db.getAllAsync<ChemicalRow>('SELECT * FROM labor_v2_chemical_items WHERE id = ?', [chemicalId]))[0]!; await appendChemicalRevision(db, chemicalId, 1, 'created', null, undefined, chemicalSnapshot(row), occurredAt); return chemicalId;
});
export const listLaborV2Chemicals = async (db: SqlExecutor, includeArchived = false): Promise<LaborV2Chemical[]> => (await db.getAllAsync<ChemicalRow>(`SELECT * FROM labor_v2_chemical_items ${includeArchived ? '' : "WHERE status != 'archived'"} ORDER BY CASE status WHEN 'available' THEN 0 WHEN 'empty' THEN 1 ELSE 2 END, added_on DESC, created_at DESC, id ASC`)).map(chemicalSnapshot);
export const getLaborV2ChemicalDetail = async (db: SqlExecutor, chemicalId: string): Promise<LaborV2ChemicalDetail> => {
  const row = (await db.getAllAsync<ChemicalRow>('SELECT * FROM labor_v2_chemical_items WHERE id = ?', [chemicalId]))[0]; if (!row) throw new Error('TAKAI V2 chemical is unavailable'); const revisions = await db.getAllAsync<ChemicalRevisionRow>('SELECT * FROM labor_v2_chemical_revisions WHERE chemical_id = ? ORDER BY revision DESC', [chemicalId]);
  return { ...chemicalSnapshot(row), revisions: revisions.map((item) => ({ id: item.id, chemicalId: item.chemical_id, revision: Number(item.revision), action: item.action, reason: item.reason, before: item.before_json ? JSON.parse(item.before_json) : null, after: JSON.parse(item.after_json), createdAt: item.created_at })) };
};
export const updateLaborV2Chemical = async (db: SqlExecutor, chemicalId: string, input: UpdateLaborV2ChemicalInput, occurredAt = now()): Promise<void> => transaction(db, async () => {
  const reason = requiredReason(input.reason, 'chemical update'); const existing = (await db.getAllAsync<ChemicalRow>("SELECT * FROM labor_v2_chemical_items WHERE id = ? AND status != 'archived'", [chemicalId]))[0]; if (!existing) throw new Error('TAKAI V2 active chemical is unavailable'); const commonName = input.commonName === undefined ? existing.common_name : text(input.commonName); if (!commonName) throw new Error('TAKAI V2 chemical common name is required'); const addedOn = input.addedOn ?? existing.added_on; date(addedOn, 'chemical added date'); const dose = chemicalDose(input.referenceAmount ?? Number(existing.reference_amount), input.referenceUnit ?? existing.reference_unit, input.referenceWaterLitres ?? Number(existing.reference_water_litres)); const before = chemicalSnapshot(existing); const revision = Number(existing.current_revision) + 1;
  await db.runAsync('UPDATE labor_v2_chemical_items SET common_name = ?, brand_name = ?, chemical_group = ?, detail = ?, reference_amount = ?, reference_unit = ?, reference_water_litres = ?, added_on = ?, current_revision = ?, updated_at = ? WHERE id = ?', [commonName, input.brandName === undefined ? existing.brand_name : text(input.brandName), input.chemicalGroup === undefined ? existing.chemical_group : text(input.chemicalGroup), input.detail === undefined ? existing.detail : text(input.detail), dose.amount, dose.unit, dose.waterLitres, addedOn, revision, occurredAt, chemicalId]);
  const after = { ...before, commonName, brandName: input.brandName === undefined ? existing.brand_name : text(input.brandName), chemicalGroup: input.chemicalGroup === undefined ? existing.chemical_group : text(input.chemicalGroup), detail: input.detail === undefined ? existing.detail : text(input.detail), referenceAmount: dose.amount, referenceUnit: dose.unit, referenceWaterLitres: dose.waterLitres, addedOn, currentRevision: revision, updatedAt: occurredAt }; await appendChemicalRevision(db, chemicalId, revision, 'updated', reason, before, after, occurredAt);
});
const changeLaborV2ChemicalStatus = async (db: SqlExecutor, chemicalId: string, status: LaborV2ChemicalStatus, action: Extract<LaborV2ChemicalRevision['action'], 'marked_empty' | 'restored_available' | 'archived' | 'restored'>, reason: string, occurredAt: string): Promise<void> => transaction(db, async () => {
  const trimmedReason = requiredReason(reason, `chemical ${action}`); const existing = (await db.getAllAsync<ChemicalRow>('SELECT * FROM labor_v2_chemical_items WHERE id = ?', [chemicalId]))[0]; if (!existing) throw new Error('TAKAI V2 chemical is unavailable'); if (existing.status === status) throw new Error(`TAKAI V2 chemical is already ${status}`); const before = chemicalSnapshot(existing); const revision = Number(existing.current_revision) + 1; const archivedAt = status === 'archived' ? occurredAt : null;
  await db.runAsync('UPDATE labor_v2_chemical_items SET status = ?, archived_at = ?, current_revision = ?, updated_at = ? WHERE id = ?', [status, archivedAt, revision, occurredAt, chemicalId]); const after = { ...before, status, archivedAt, currentRevision: revision, updatedAt: occurredAt }; await appendChemicalRevision(db, chemicalId, revision, action, trimmedReason, before, after, occurredAt);
});
export const markLaborV2ChemicalEmpty = (db: SqlExecutor, chemicalId: string, reason: string, occurredAt = now()): Promise<void> => changeLaborV2ChemicalStatus(db, chemicalId, 'empty', 'marked_empty', reason, occurredAt);
export const restoreLaborV2ChemicalAvailable = (db: SqlExecutor, chemicalId: string, reason: string, occurredAt = now()): Promise<void> => changeLaborV2ChemicalStatus(db, chemicalId, 'available', 'restored_available', reason, occurredAt);
export const archiveLaborV2Chemical = (db: SqlExecutor, chemicalId: string, reason: string, occurredAt = now()): Promise<void> => changeLaborV2ChemicalStatus(db, chemicalId, 'archived', 'archived', reason, occurredAt);
export const restoreLaborV2Chemical = (db: SqlExecutor, chemicalId: string, reason: string, occurredAt = now()): Promise<void> => changeLaborV2ChemicalStatus(db, chemicalId, 'available', 'restored', reason, occurredAt);

export const recordLaborDayV2 = async (db: SqlExecutor, input: RecordLaborDayV2Input, occurredAt = now()): Promise<{ taskIds: string[]; dailyUnitIds: string[]; hourlyShiftIds: string[] }> => transaction(db, async () => {
  date(input.workDate, 'work date');
  const taskFacts = input.tasks.map((task, index) => ({ id: task.id ?? `labor-v2-task-${index + 1}-${id('')}`, workDate: input.workDate, title: task.title, note: task.note, assigneePersonIds: task.assigneePersonIds, plotTargets: task.plotTargets ?? [] }));
  const daily = (input.daily ?? []).map((unit, index) => ({ id: unit.id ?? `labor-v2-daily-${index + 1}-${id('')}`, ...unit, workDate: input.workDate }));
  const hourly = (input.hourly ?? []).map((entry, index) => ({ id: entry.id ?? `labor-v2-hourly-${index + 1}-${id('')}`, ...entry, workDate: input.workDate }));
  const plan = planLaborCompensationV2({ tasks: taskFacts, daily, hourly, contracts: [] });
  for (const task of taskFacts) {
    if (new Set(task.plotTargets.map((target) => target.plotId)).size !== task.plotTargets.length) throw new Error('TAKAI V2 task plot targets must be distinct per task');
    for (const target of task.plotTargets) {
      if (!text(target.plotId)) throw new Error('TAKAI V2 task plot target requires a plot');
      const labels = (target.treeLabels ?? []).map(text);
      if (labels.some((label) => !label) || new Set(labels).size !== labels.length) throw new Error('TAKAI V2 task tree labels must be distinct and nonblank');
    }
  }
  const plotsById = await activePlots(db, [...new Set(taskFacts.flatMap((task) => task.plotTargets.map((target) => target.plotId)))]);
  for (const task of taskFacts) for (const personId of task.assigneePersonIds) await worker(db, personId);
  for (const task of taskFacts) {
    await db.runAsync('INSERT INTO labor_v2_work_tasks (id, work_date, title, note, created_at) VALUES (?, ?, ?, ?, ?)', [task.id, task.workDate, text(task.title), text(task.note), occurredAt]);
    for (const [sort, personId] of task.assigneePersonIds.entries()) await db.runAsync('INSERT INTO labor_v2_task_assignments (id, task_id, person_id, sort_order, note) VALUES (?, ?, ?, ?, ?)', [id('labor-v2-assignment'), task.id, personId, sort, '']);
    for (const [sort, target] of task.plotTargets.entries()) {
      const plot = plotsById.get(target.plotId)!;
      const targetId = id('labor-v2-task-plot-target');
      await db.runAsync('INSERT INTO labor_v2_task_plot_targets (id, task_id, plot_id, plot_name_snapshot, sort_order) VALUES (?, ?, ?, ?, ?)', [targetId, task.id, target.plotId, plot.name, sort]);
      for (const [treeSort, treeLabel] of (target.treeLabels ?? []).map(text).entries()) await db.runAsync('INSERT INTO labor_v2_task_plot_tree_refs (id, task_plot_target_id, tree_label, sort_order) VALUES (?, ?, ?, ?)', [id('labor-v2-tree-ref'), targetId, treeLabel, treeSort]);
    }
    await event(db, { entityType: 'work_task', entityId: task.id, action: 'recorded', occurredAt, after: task });
  }
  const dailyUnitIds: string[] = [];
  for (const unit of plan.dailyUnits) {
    await worker(db, unit.personId);
    const existing = (await db.getAllAsync<{ id: string; rate_satang: number; quantity_milli: number }>('SELECT id, rate_satang, quantity_milli FROM labor_v2_daily_units WHERE person_id = ? AND work_date = ?', [unit.personId, unit.workDate]))[0];
    const unitId = existing?.id ?? unit.id;
    if (existing && (Number(existing.rate_satang) !== unit.rateSatang || Number(existing.quantity_milli) !== unit.quantityMilli)) throw new Error('TAKAI V2 daily unit already exists with different compensation facts');
    if (!existing) {
      await db.runAsync('INSERT INTO labor_v2_daily_units (id, person_id, work_date, rate_satang, quantity_milli, created_at) VALUES (?, ?, ?, ?, ?, ?)', [unitId, unit.personId, unit.workDate, unit.rateSatang, unit.quantityMilli, occurredAt]);
      await db.runAsync('INSERT INTO labor_v2_obligations (id, source_kind, source_unit_id, recipient_kind, person_id, due_satang, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [`obligation:daily:${unitId}`, 'daily', unitId, 'person', unit.personId, unit.dueSatang, 'open', occurredAt]);
    }
    for (const taskId of unit.taskIds) await db.runAsync('INSERT OR IGNORE INTO labor_v2_daily_unit_task_links (daily_unit_id, task_id) VALUES (?, ?)', [unitId, taskId]);
    dailyUnitIds.push(unitId); await event(db, { entityType: 'daily_unit', entityId: unitId, action: existing ? 'task_linked' : 'created', occurredAt, after: { ...unit, id: unitId } });
  }
  const hourlyShiftIds: string[] = [];
  for (const shift of plan.hourlyShifts) {
    await worker(db, shift.personId);
    const existing = (await db.getAllAsync<{ id: string }>('SELECT id FROM labor_v2_hourly_shifts WHERE person_id = ? AND work_date = ? AND rate_satang = ? AND shift_key = ?', [shift.personId, shift.workDate, shift.rateSatang, shift.shiftKey]))[0];
    const shiftId = existing?.id ?? shift.id;
    if (!existing) {
      await db.runAsync('INSERT INTO labor_v2_hourly_shifts (id, person_id, work_date, rate_satang, shift_key, created_at) VALUES (?, ?, ?, ?, ?, ?)', [shiftId, shift.personId, shift.workDate, shift.rateSatang, shift.shiftKey, occurredAt]);
      await db.runAsync('INSERT INTO labor_v2_obligations (id, source_kind, source_unit_id, recipient_kind, person_id, due_satang, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [`obligation:hourly:${shiftId}`, 'hourly', shiftId, 'person', shift.personId, shift.totalSatang, 'open', occurredAt]);
    } else throw new Error('TAKAI V2 hourly shift upsert across commands is deferred until paid-safe aggregation is implemented');
    for (const entryId of shift.taskTimeEntryIds) { const entry = hourly.find((item) => item.id === entryId)!; const assignment = (await db.getAllAsync<{ id: string }>('SELECT id FROM labor_v2_task_assignments WHERE task_id = ? AND person_id = ?', [entry.taskId, entry.personId]))[0]!; await db.runAsync('INSERT INTO labor_v2_hourly_time_entries (id, hourly_shift_id, task_assignment_id, duration_minutes, note, created_at) VALUES (?, ?, ?, ?, ?, ?)', [entry.id, shiftId, assignment.id, entry.durationMinutes, text(entry.note), occurredAt]); }
    hourlyShiftIds.push(shiftId); await event(db, { entityType: 'hourly_shift', entityId: shiftId, action: 'created', occurredAt, after: shift });
  }
  return { taskIds: taskFacts.map((task) => task.id), dailyUnitIds, hourlyShiftIds };
});

export const startLaborContractBatchV2 = async (db: SqlExecutor, input: StartLaborContractBatchV2Input, occurredAt = now()): Promise<string> => transaction(db, async () => {
  date(input.startsOn, 'contract start'); if (input.deadlineOn) date(input.deadlineOn, 'contract deadline'); if (!text(input.title) || !input.memberPersonIds.length || new Set(input.memberPersonIds).size !== input.memberPersonIds.length) throw new Error('TAKAI V2 contract batch requires a title and distinct members');
  for (const member of input.memberPersonIds) await worker(db, member); const batchId = input.id ?? id('labor-v2-contract');
  await db.runAsync("INSERT INTO labor_v2_contract_batches (id, title, starts_on, deadline_on, note, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)", [batchId, text(input.title), input.startsOn, input.deadlineOn ?? null, text(input.note), occurredAt]);
  for (const [sort, personId] of input.memberPersonIds.entries()) await db.runAsync('INSERT INTO labor_v2_contract_batch_members (id, contract_batch_id, person_id, sort_order) VALUES (?, ?, ?, ?)', [id('labor-v2-member'), batchId, personId, sort]);
  for (const taskId of input.taskIds ?? []) await db.runAsync('INSERT INTO labor_v2_contract_batch_task_links (contract_batch_id, task_id) VALUES (?, ?)', [batchId, taskId]);
  await event(db, { entityType: 'contract_batch', entityId: batchId, action: 'started', occurredAt, after: input }); return batchId;
});

export const recordLaborContractProgressV2 = async (db: SqlExecutor, batchId: string, input: RecordLaborContractProgressV2Input, occurredAt = now()): Promise<string> => transaction(db, async () => {
  date(input.progressDate, 'contract progress'); const batch = (await db.getAllAsync<{ id: string }>("SELECT id FROM labor_v2_contract_batches WHERE id = ? AND status = 'open'", [batchId]))[0]; if (!batch) throw new Error('TAKAI V2 open contract batch is unavailable'); if (input.quantityMilli !== undefined) positive(input.quantityMilli, 'contract progress quantity');
  const progressId = input.id ?? id('labor-v2-progress'); await db.runAsync('INSERT INTO labor_v2_contract_progress (id, contract_batch_id, progress_date, note, quantity_milli, unit_label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [progressId, batchId, input.progressDate, text(input.note), input.quantityMilli ?? null, text(input.unitLabel), occurredAt]); await event(db, { entityType: 'contract_batch', entityId: batchId, action: 'progress_recorded', occurredAt, after: input }); return progressId;
});

export const listOpenLaborContractBatchesV2 = async (db: SqlExecutor): Promise<LaborV2OpenContractBatch[]> => {
  const batches = await db.getAllAsync<{ id: string; title: string; starts_on: string }>("SELECT id, title, starts_on FROM labor_v2_contract_batches WHERE status = 'open' ORDER BY starts_on DESC, id ASC");
  const members = await db.getAllAsync<{ contract_batch_id: string; person_id: string }>('SELECT contract_batch_id, person_id FROM labor_v2_contract_batch_members ORDER BY sort_order ASC, id ASC');
  return batches.map((batch) => ({ id: batch.id, title: batch.title, startsOn: batch.starts_on, memberPersonIds: members.filter((member) => member.contract_batch_id === batch.id).map((member) => member.person_id) }));
};

/** Shared person-finance rows, exposed through a V2-only UI boundary; no v1 payable is created. */
export const createLaborV2PersonAdvance = async (db: SqlExecutor, input: CreateLaborWorkerAdvanceInput, occurredAt = now()): Promise<string> => {
  const advanceId = await createLaborWorkerAdvance(db, input, occurredAt);
  await event(db, { entityType: 'person_advance', entityId: advanceId, action: 'issued', occurredAt, after: { ...input, id: advanceId } });
  return advanceId;
};
export const listLaborV2PersonAdvances = (db: SqlExecutor, personId?: string): Promise<LaborWorkerAdvance[]> => listLaborWorkerAdvances(db, personId);

export const finalizeLaborContractBatchV2 = async (db: SqlExecutor, batchId: string, input: FinalizeLaborContractBatchV2Input, occurredAt = now()): Promise<string> => transaction(db, async () => {
  date(input.finalizedAt, 'contract finalization'); const batch = (await db.getAllAsync<{ id: string }>("SELECT id FROM labor_v2_contract_batches WHERE id = ? AND status = 'open'", [batchId]))[0]; if (!batch) throw new Error('TAKAI V2 open contract batch is unavailable');
  const finalization = input.finalization; const due = finalization.kind === 'quantity_rate' ? (() => { positive(finalization.quantityMilli, 'contract quantity'); positive(finalization.rateSatang, 'contract rate'); const total = finalization.quantityMilli * finalization.rateSatang; if (total % 1000) throw new Error('TAKAI V2 contract finalization must resolve to whole satang'); return total / 1000; })() : finalization.finalTotalSatang; positive(due, 'contract final total');
  await db.runAsync('UPDATE labor_v2_contract_batches SET status = ?, finalization_basis = ?, quantity_milli = ?, rate_satang = ?, final_total_satang = ?, finalized_at = ? WHERE id = ?', ['finalized', finalization.kind, finalization.kind === 'quantity_rate' ? finalization.quantityMilli : null, finalization.kind === 'quantity_rate' ? finalization.rateSatang : null, due, input.finalizedAt, batchId]);
  const obligationId = `obligation:contract:${batchId}`; await db.runAsync('INSERT INTO labor_v2_obligations (id, source_kind, source_unit_id, recipient_kind, person_id, due_satang, status, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)', [obligationId, 'contract', batchId, 'group', due, 'open', occurredAt]); await event(db, { entityType: 'contract_batch', entityId: batchId, action: 'finalized', occurredAt, after: { ...input, dueSatang: due } }); return obligationId;
});

export const postLaborV2PaymentSession = async (db: SqlExecutor, input: PostLaborV2PaymentSessionInput, occurredAt = now()): Promise<string> => transaction(db, async () => {
  date(input.paymentDate, 'payment date'); if (!input.settlements.length) throw new Error('TAKAI V2 payment requires settlements'); if (new Set(input.settlements.map((item) => item.obligationId)).size !== input.settlements.length) throw new Error('TAKAI V2 payment cannot include an obligation more than once'); const sessionId = input.id ?? id('labor-v2-payment'); let cash = 0;
  const prepared = [] as Array<{ id: string; obligationId: string; recipientKind: 'person' | 'group'; personId: string | null; wage: number; bonus: number; recoveries: Array<{ id: string; advanceId: string; amountSatang: number }> }>;
  for (const row of input.settlements) {
    positive(row.wageSatang, 'payment wage'); const obligation = (await db.getAllAsync<{ id: string; recipient_kind: 'person' | 'group'; person_id: string | null; due_satang: number }>('SELECT id, recipient_kind, person_id, due_satang FROM labor_v2_obligations WHERE id = ? AND status = ?', [row.obligationId, 'open']))[0]; if (!obligation) throw new Error('TAKAI V2 obligation is unavailable or unpriced');
    const paid = Number((await db.getAllAsync<{ amount: number }>("SELECT COALESCE(SUM(settlement.wage_satang), 0) AS amount FROM labor_v2_payment_recipient_settlements AS settlement JOIN labor_v2_payment_sessions AS session ON session.id = settlement.payment_session_id WHERE settlement.obligation_id = ? AND session.status IN ('posted', 'revised')", [row.obligationId]))[0]!.amount); if (row.wageSatang > Number(obligation.due_satang) - paid) throw new Error('TAKAI V2 payment cannot exceed obligation remaining balance');
    const recoveries = row.advanceRecoveries ?? []; if (obligation.recipient_kind === 'group' && recoveries.length) throw new Error('TAKAI V2 group obligation cannot recover a person advance'); const bonus = row.bonusSatang ?? 0; if (!Number.isSafeInteger(bonus) || bonus < 0) throw new Error('TAKAI V2 bonus must be a whole non-negative satang amount'); if (recoveries.reduce((sum, recovery) => sum + recovery.amountSatang, 0) > row.wageSatang) throw new Error('TAKAI V2 total advance recovery cannot exceed wage allocation');
    for (const recovery of recoveries) { positive(recovery.amountSatang, 'advance recovery'); const advance = (await db.getAllAsync<{ person_id: string; amount_satang: number }>("SELECT person_id, amount_satang FROM labor_worker_advances WHERE id = ? AND status IN ('posted', 'revised')", [recovery.advanceId]))[0]; if (!advance || advance.person_id !== obligation.person_id) throw new Error('TAKAI V2 advance recovery requires the same person obligation'); if (recovery.amountSatang > row.wageSatang) throw new Error('TAKAI V2 advance recovery cannot exceed wage allocation'); const prior = Number((await db.getAllAsync<{ amount: number }>('SELECT COALESCE((SELECT SUM(amount_satang) FROM labor_advance_deductions WHERE labor_worker_advance_id = ?), 0) + COALESCE((SELECT SUM(recovery.amount_satang) FROM labor_v2_payment_advance_recoveries recovery JOIN labor_v2_payment_recipient_settlements settlement ON settlement.id = recovery.recipient_settlement_id JOIN labor_v2_payment_sessions session ON session.id = settlement.payment_session_id WHERE recovery.labor_worker_advance_id = ? AND session.status IN (\'posted\', \'revised\')), 0) AS amount', [recovery.advanceId, recovery.advanceId]))[0]!.amount); const inSession = recoveries.filter((item) => item.advanceId === recovery.advanceId).reduce((sum, item) => sum + item.amountSatang, 0); if (prior + inSession > Number(advance.amount_satang)) throw new Error('TAKAI V2 advance recovery cannot exceed advance remaining balance'); }
    prepared.push({ id: row.id ?? id('labor-v2-settlement'), obligationId: row.obligationId, recipientKind: obligation.recipient_kind, personId: obligation.person_id, wage: row.wageSatang, bonus, recoveries: recoveries.map((recovery) => ({ ...recovery, id: recovery.id ?? id('labor-v2-recovery') })) }); cash += row.wageSatang + bonus - recoveries.reduce((sum, recovery) => sum + recovery.amountSatang, 0);
  }
  if (cash < 0) throw new Error('TAKAI V2 payment cash cannot be negative'); await db.runAsync('INSERT INTO labor_v2_payment_sessions (id, payment_date, cash_paid_satang, method, note, status, current_revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)', [sessionId, input.paymentDate, cash, text(input.method), text(input.note), 'posted', occurredAt, occurredAt]);
  for (const row of prepared) { const recovered = row.recoveries.reduce((sum, recovery) => sum + recovery.amountSatang, 0); await db.runAsync('INSERT INTO labor_v2_payment_recipient_settlements (id, payment_session_id, obligation_id, recipient_kind, person_id, wage_satang, bonus_satang, advance_recovered_satang, cash_paid_satang) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [row.id, sessionId, row.obligationId, row.recipientKind, row.personId, row.wage, row.bonus, recovered, row.wage + row.bonus - recovered]); for (const recovery of row.recoveries) await db.runAsync('INSERT INTO labor_v2_payment_advance_recoveries (id, recipient_settlement_id, labor_worker_advance_id, obligation_id, person_id, amount_satang) VALUES (?, ?, ?, ?, ?, ?)', [recovery.id, row.id, recovery.advanceId, row.obligationId, row.personId, recovery.amountSatang]); const remaining = Number((await db.getAllAsync<{ amount: number }>('SELECT COALESCE(SUM(wage_satang), 0) AS amount FROM labor_v2_payment_recipient_settlements WHERE obligation_id = ?', [row.obligationId]))[0]!.amount); const due = Number((await db.getAllAsync<{ due_satang: number }>('SELECT due_satang FROM labor_v2_obligations WHERE id = ?', [row.obligationId]))[0]!.due_satang); if (remaining === due) await db.runAsync("UPDATE labor_v2_obligations SET status = 'settled' WHERE id = ?", [row.obligationId]); }
  await event(db, { entityType: 'payment_session', entityId: sessionId, action: 'posted', occurredAt, after: { cashPaidSatang: cash, settlements: prepared.map((row) => ({ obligationId: row.obligationId, wageSatang: row.wage })) } }); return sessionId;
});

export const correctLaborV2PaymentSession = async (db: SqlExecutor, paymentSessionId: string, input: CorrectLaborV2PaymentSessionInput, occurredAt = now()): Promise<void> => transaction(db, async () => {
  if (!text(input.reason)) throw new Error('TAKAI V2 payment correction requires a reason'); const before = (await db.getAllAsync<{ method: string; note: string; current_revision: number }>("SELECT method, note, current_revision FROM labor_v2_payment_sessions WHERE id = ? AND status = 'posted'", [paymentSessionId]))[0]; if (!before) throw new Error('TAKAI V2 payment session is unavailable'); const after = { method: input.method === undefined ? before.method : text(input.method), note: input.note === undefined ? before.note : text(input.note), currentRevision: Number(before.current_revision) + 1 }; await db.runAsync('UPDATE labor_v2_payment_sessions SET method = ?, note = ?, current_revision = ?, updated_at = ? WHERE id = ?', [after.method, after.note, after.currentRevision, occurredAt, paymentSessionId]); await db.runAsync('INSERT INTO labor_v2_payment_revisions (id, payment_session_id, reason, before_json, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id('labor-v2-revision'), paymentSessionId, text(input.reason), JSON.stringify(before), JSON.stringify(after), occurredAt]); await event(db, { entityType: 'payment_session', entityId: paymentSessionId, action: 'corrected', reason: text(input.reason), occurredAt, before, after });
});

export const getLaborV2ReadModel = async (db: SqlExecutor): Promise<LaborV2ReadModel> => {
  const [tasks, obligations, payments, events, assignees, plotTargets, treeRefs] = await Promise.all([
    db.getAllAsync<{ id: string; work_date: string; title: string }>('SELECT id, work_date, title FROM labor_v2_work_tasks ORDER BY work_date DESC, id ASC'),
    db.getAllAsync<{ id: string; source_kind: 'daily' | 'hourly' | 'contract'; source_unit_id: string; recipient_kind: 'person' | 'group'; person_id: string | null; due_satang: number; paid_satang: number }>("SELECT obligation.id, obligation.source_kind, obligation.source_unit_id, obligation.recipient_kind, obligation.person_id, obligation.due_satang, COALESCE((SELECT SUM(settlement.wage_satang) FROM labor_v2_payment_recipient_settlements settlement JOIN labor_v2_payment_sessions session ON session.id = settlement.payment_session_id WHERE settlement.obligation_id = obligation.id AND session.status IN ('posted', 'revised')), 0) AS paid_satang FROM labor_v2_obligations obligation WHERE obligation.status != 'cancelled' ORDER BY obligation.created_at ASC"),
    db.getAllAsync<{ id: string; payment_date: string; method: string; cash_paid_satang: number; current_revision: number }>("SELECT id, payment_date, method, cash_paid_satang, current_revision FROM labor_v2_payment_sessions WHERE status IN ('posted', 'revised') ORDER BY payment_date DESC, created_at DESC"),
    db.getAllAsync<{ id: string; entity_type: string; entity_id: string; action: string; reason: string | null; occurred_at: string }>('SELECT id, entity_type, entity_id, action, reason, occurred_at FROM labor_v2_event_history ORDER BY occurred_at ASC, id ASC'),
    db.getAllAsync<{ task_id: string; person_id: string }>('SELECT task_id, person_id FROM labor_v2_task_assignments ORDER BY sort_order ASC, id ASC'),
    db.getAllAsync<TaskPlotTargetRow>('SELECT target.id, target.task_id, target.plot_id, target.plot_name_snapshot, target.sort_order, plot.name AS current_name FROM labor_v2_task_plot_targets target JOIN labor_v2_plots plot ON plot.id = target.plot_id ORDER BY target.task_id ASC, target.sort_order ASC, target.id ASC'),
    db.getAllAsync<TaskPlotTreeRefRow>('SELECT tree.task_plot_target_id, tree.tree_label, tree.sort_order FROM labor_v2_task_plot_tree_refs tree JOIN labor_v2_task_plot_targets target ON target.id = tree.task_plot_target_id ORDER BY tree.task_plot_target_id ASC, tree.sort_order ASC, tree.id ASC'),
  ]);
  const treesByTargetId = new Map<string, string[]>();
  for (const tree of treeRefs) treesByTargetId.set(tree.task_plot_target_id, [...(treesByTargetId.get(tree.task_plot_target_id) ?? []), tree.tree_label]);
  const targetsByTaskId = new Map<string, LaborV2ReadModel['tasks'][number]['plotTargets']>();
  for (const target of plotTargets) targetsByTaskId.set(target.task_id, [...(targetsByTaskId.get(target.task_id) ?? []), { plotId: target.plot_id, currentName: target.current_name, recordedName: target.plot_name_snapshot, wasRenamed: target.current_name !== target.plot_name_snapshot, treeLabels: treesByTargetId.get(target.id) ?? [] }]);
  return { sourceVersion: 'v2', tasks: tasks.map((task) => ({ id: task.id, workDate: task.work_date, title: task.title, assigneePersonIds: assignees.filter((entry) => entry.task_id === task.id).map((entry) => entry.person_id), plotTargets: targetsByTaskId.get(task.id) ?? [] })), obligations: obligations.map((item) => ({ id: item.id, sourceKind: item.source_kind, sourceUnitId: item.source_unit_id, recipientKind: item.recipient_kind, personId: item.person_id, dueSatang: Number(item.due_satang), paidSatang: Number(item.paid_satang), remainingSatang: Number(item.due_satang) - Number(item.paid_satang), status: Number(item.due_satang) === Number(item.paid_satang) ? 'settled' : 'open' })), payments: payments.map((item) => ({ id: item.id, paymentDate: item.payment_date, method: item.method, cashPaidSatang: Number(item.cash_paid_satang), currentRevision: Number(item.current_revision) })), events: events.map((item) => ({ id: item.id, entityType: item.entity_type, entityId: item.entity_id, action: item.action, reason: item.reason, occurredAt: item.occurred_at })) };
};

/** Typed V2 read seams for Today, calendar, history, person, unpaid, and money history. */
const state = (due: number, paid: number): Exclude<LaborV2TaskWageContext['state'], 'open_unpriced'> => paid === 0 ? 'unpaid' : paid >= due ? 'paid' : 'partial';
const decodeCursor = (cursor?: string): { workDate: string; id: string } | null => { if (!cursor) return null; try { const value = JSON.parse(decodeURIComponent(cursor)); return typeof value.workDate === 'string' && typeof value.id === 'string' ? value : null; } catch { throw new Error('TAKAI V2 work cursor is invalid'); } };
const encodeCursor = (task: LaborV2ReadModel['tasks'][number]): string => encodeURIComponent(JSON.stringify({ workDate: task.workDate, id: task.id }));
const contextsForTask = async (db: SqlExecutor, taskId: string): Promise<LaborV2TaskWageContext[]> => {
  const [daily, hourly, contracts] = await Promise.all([
    db.getAllAsync<{ id: string; person_id: string; due_satang: number; paid_satang: number }>(`SELECT unit.id, unit.person_id, obligation.due_satang, COALESCE((SELECT SUM(settlement.wage_satang) FROM labor_v2_payment_recipient_settlements settlement JOIN labor_v2_payment_sessions session ON session.id = settlement.payment_session_id WHERE settlement.obligation_id = obligation.id AND session.status IN ('posted', 'revised')), 0) paid_satang FROM labor_v2_daily_unit_task_links link JOIN labor_v2_daily_units unit ON unit.id = link.daily_unit_id JOIN labor_v2_obligations obligation ON obligation.source_kind = 'daily' AND obligation.source_unit_id = unit.id WHERE link.task_id = ? AND obligation.status != 'cancelled'`, [taskId]),
    db.getAllAsync<{ id: string; person_id: string; due_satang: number; paid_satang: number }>(`SELECT shift.id, shift.person_id, obligation.due_satang, COALESCE((SELECT SUM(settlement.wage_satang) FROM labor_v2_payment_recipient_settlements settlement JOIN labor_v2_payment_sessions session ON session.id = settlement.payment_session_id WHERE settlement.obligation_id = obligation.id AND session.status IN ('posted', 'revised')), 0) paid_satang FROM labor_v2_hourly_time_entries entry JOIN labor_v2_task_assignments assignment ON assignment.id = entry.task_assignment_id JOIN labor_v2_hourly_shifts shift ON shift.id = entry.hourly_shift_id JOIN labor_v2_obligations obligation ON obligation.source_kind = 'hourly' AND obligation.source_unit_id = shift.id WHERE assignment.task_id = ? AND obligation.status != 'cancelled'`, [taskId]),
    db.getAllAsync<{ id: string; status: 'open' | 'finalized'; final_total_satang: number | null; paid_satang: number }>(`SELECT batch.id, batch.status, batch.final_total_satang, COALESCE((SELECT SUM(settlement.wage_satang) FROM labor_v2_payment_recipient_settlements settlement JOIN labor_v2_payment_sessions session ON session.id = settlement.payment_session_id JOIN labor_v2_obligations obligation ON obligation.id = settlement.obligation_id WHERE obligation.source_kind = 'contract' AND obligation.source_unit_id = batch.id AND session.status IN ('posted', 'revised')), 0) paid_satang FROM labor_v2_contract_batch_task_links link JOIN labor_v2_contract_batches batch ON batch.id = link.contract_batch_id WHERE link.task_id = ? AND batch.status != 'cancelled'`, [taskId]),
  ]);
  return [
    ...daily.map((row) => ({ sourceKind: 'daily' as const, sourceUnitId: row.id, recipientKind: 'person' as const, personId: row.person_id, dueSatang: Number(row.due_satang), paidSatang: Number(row.paid_satang), remainingSatang: Number(row.due_satang) - Number(row.paid_satang), state: state(Number(row.due_satang), Number(row.paid_satang)) })),
    ...hourly.map((row) => ({ sourceKind: 'hourly' as const, sourceUnitId: row.id, recipientKind: 'person' as const, personId: row.person_id, dueSatang: Number(row.due_satang), paidSatang: Number(row.paid_satang), remainingSatang: Number(row.due_satang) - Number(row.paid_satang), state: state(Number(row.due_satang), Number(row.paid_satang)) })),
    ...contracts.map((row) => row.status === 'open' ? ({ sourceKind: 'contract' as const, sourceUnitId: row.id, recipientKind: 'group' as const, personId: null, dueSatang: null, paidSatang: 0, remainingSatang: null, state: 'open_unpriced' as const }) : ({ sourceKind: 'contract' as const, sourceUnitId: row.id, recipientKind: 'group' as const, personId: null, dueSatang: Number(row.final_total_satang), paidSatang: Number(row.paid_satang), remainingSatang: Number(row.final_total_satang) - Number(row.paid_satang), state: state(Number(row.final_total_satang), Number(row.paid_satang)) })),
  ];
};

export const getTaskDetailV2 = async (db: SqlExecutor, taskId: string): Promise<LaborV2TaskDetail> => {
  const task = (await getLaborV2ReadModel(db)).tasks.find((item) => item.id === taskId);
  if (!task) throw new Error('TAKAI V2 work task is unavailable');
  return { ...task, wageContexts: await contextsForTask(db, taskId) };
};

export const getWorkListV2 = async (db: SqlExecutor, filters: LaborV2WorkListFilters = {}, cursor?: string, limit = 50): Promise<LaborV2WorkList> => {
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 100) throw new Error('TAKAI V2 work limit must be between 1 and 100');
  if (filters.startDate) date(filters.startDate, 'work start'); if (filters.endDate) date(filters.endDate, 'work end'); if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) throw new Error('TAKAI V2 work start must not follow end');
  const marker = decodeCursor(cursor); const tasks = (await getLaborV2ReadModel(db)).tasks.filter((task) => (!filters.startDate || task.workDate >= filters.startDate) && (!filters.endDate || task.workDate <= filters.endDate) && (!filters.personId || task.assigneePersonIds.includes(filters.personId)) && (!marker || task.workDate < marker.workDate || (task.workDate === marker.workDate && task.id > marker.id)));
  const details = await Promise.all(tasks.map((task) => getTaskDetailV2(db, task.id)));
  const filtered = details.filter((task) => (!filters.sourceKind || task.wageContexts.some((context) => context.sourceKind === filters.sourceKind)) && (!filters.wageState || task.wageContexts.some((context) => context.state === filters.wageState)));
  const items = filtered.slice(0, limit); return { sourceVersion: 'v2', items, nextCursor: filtered.length > items.length ? encodeCursor(items.at(-1)!) : null };
};

export const getLaborV2Today = async (db: SqlExecutor, workDate: string): Promise<LaborV2TodayProjection> => {
  date(workDate, 'today date'); const [work, model] = await Promise.all([getWorkListV2(db, { startDate: workDate, endDate: workDate }, undefined, 5), getLaborV2ReadModel(db)]);
  return { sourceVersion: 'v2', date: workDate, tasks: work.items, unpaid: model.obligations.filter((item) => item.remainingSatang > 0).slice(0, 5) };
};

export const getLaborV2Calendar = async (db: SqlExecutor, startDate: string, endDate: string): Promise<{ sourceVersion: 'v2'; days: LaborV2CalendarDay[] }> => {
  date(startDate, 'calendar start'); date(endDate, 'calendar end'); if (startDate > endDate) throw new Error('TAKAI V2 calendar start must not follow end'); const model = await getLaborV2ReadModel(db); const grouped = new Map<string, LaborV2CalendarDay>();
  for (const task of model.tasks.filter((item) => item.workDate >= startDate && item.workDate <= endDate)) { const day = grouped.get(task.workDate) ?? { workDate: task.workDate, taskCount: 0, taskIds: [], tasks: [] }; day.taskCount += 1; day.taskIds.push(task.id); day.tasks.push(task); grouped.set(task.workDate, day); }
  return { sourceVersion: 'v2', days: [...grouped.values()].sort((left, right) => left.workDate.localeCompare(right.workDate)) };
};

export const getCalendarMonthV2 = async (db: SqlExecutor, month: string): Promise<LaborV2CalendarMonth> => {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('TAKAI V2 calendar month must be YYYY-MM');
  const startDate = `${month}-01`; const dateValue = new Date(`${startDate}T00:00:00.000Z`); if (Number.isNaN(dateValue.valueOf()) || dateValue.getUTCMonth() + 1 !== Number(month.slice(5))) throw new Error('TAKAI V2 calendar month is invalid'); const lastDate = new Date(Date.UTC(dateValue.getUTCFullYear(), dateValue.getUTCMonth() + 1, 0)).getUTCDate(); const endDate = `${month}-${String(lastDate).padStart(2, '0')}`;
  const calendar = await getLaborV2Calendar(db, startDate, endDate); const byDate = new Map(calendar.days.map((day) => [day.workDate, day]));
  return { sourceVersion: 'v2', month, days: Array.from({ length: lastDate }, (_, index) => { const workDate = `${month}-${String(index + 1).padStart(2, '0')}`; return { workDate, taskCount: byDate.get(workDate)?.taskCount ?? 0, taskIds: byDate.get(workDate)?.taskIds ?? [], tasks: byDate.get(workDate)?.tasks ?? [], isInMonth: true }; }) };
};

export const getLaborV2History = async (db: SqlExecutor): Promise<LaborV2ReadModel['events']> => (await getLaborV2ReadModel(db)).events;
export const getLaborV2Unpaid = async (db: SqlExecutor): Promise<LaborV2ReadModel['obligations']> => (await getLaborV2ReadModel(db)).obligations.filter((item) => item.remainingSatang > 0);

const paymentBatchItemsV2 = async (db: SqlExecutor): Promise<LaborV2PaymentBatchDraftItem[]> => {
  const [model, daily, hourly, contracts] = await Promise.all([
    getLaborV2ReadModel(db),
    db.getAllAsync<{ id: string; work_date: string }>('SELECT id, work_date FROM labor_v2_daily_units'),
    db.getAllAsync<{ id: string; work_date: string }>('SELECT id, work_date FROM labor_v2_hourly_shifts'),
    db.getAllAsync<{ id: string; title: string; finalized_at: string | null }>('SELECT id, title, finalized_at FROM labor_v2_contract_batches'),
  ]);
  const dailyDates = new Map(daily.map((row) => [row.id, row.work_date]));
  const hourlyDates = new Map(hourly.map((row) => [row.id, row.work_date]));
  const contractFacts = new Map(contracts.map((row) => [row.id, row]));
  return model.obligations
    .filter((item) => item.remainingSatang > 0)
    .map((item) => {
      const fact = item.sourceKind === 'daily'
        ? { title: 'งานรายวัน', effectiveDate: dailyDates.get(item.sourceUnitId) }
        : item.sourceKind === 'hourly'
          ? { title: 'งานรายชั่วโมง', effectiveDate: hourlyDates.get(item.sourceUnitId) }
          : { title: contractFacts.get(item.sourceUnitId)?.title, effectiveDate: contractFacts.get(item.sourceUnitId)?.finalized_at ?? undefined };
      if (!fact.title || !fact.effectiveDate) throw new Error(`TAKAI V2 payment obligation source is unavailable: ${item.id}`);
      return {
        obligationId: item.id,
        sourceKind: item.sourceKind,
        sourceUnitId: item.sourceUnitId,
        recipientKind: item.recipientKind,
        personId: item.personId,
        recipientLabel: (item.recipientKind === 'group' ? 'ชุดรับเงิน' : 'คนทำงาน') as LaborV2PaymentBatchDraftItem['recipientLabel'],
        title: fact.title,
        effectiveDate: fact.effectiveDate,
        dueSatang: item.dueSatang,
        paidSatang: item.paidSatang,
        remainingSatang: item.remainingSatang,
      };
    })
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate) || left.obligationId.localeCompare(right.obligationId));
};

/**
 * Reconciles a UI selection against repository-derived unpaid obligations.
 * A person context limits only the picker options; already-selected global
 * group rows survive rehydration so navigation cannot silently drop cash rows.
 */
export const reconcileLaborV2PaymentBatchDraft = (items: LaborV2PaymentBatchDraftItem[], input: LaborV2PaymentBatchDraftInput = {}): LaborV2PaymentBatchDraft => {
  const selectedIds = [...new Set(input.selectedObligationIds ?? [])];
  const byId = new Map(items.map((item) => [item.obligationId, item]));
  const selected = selectedIds.flatMap((id) => byId.get(id) ? [byId.get(id)!] : []);
  const available = input.personId
    ? items.filter((item) => item.recipientKind === 'person' && item.personId === input.personId)
    : items;
  return {
    sourceVersion: 'v2',
    contextPersonId: input.personId ?? null,
    available,
    selected,
    unavailableSelectionIds: selectedIds.filter((id) => !byId.has(id)),
  };
};

export const getLaborV2PaymentBatchDraft = async (db: SqlExecutor, input: LaborV2PaymentBatchDraftInput = {}): Promise<LaborV2PaymentBatchDraft> => reconcileLaborV2PaymentBatchDraft(await paymentBatchItemsV2(db), input);

export const getLaborV2MoneyHistory = async (db: SqlExecutor): Promise<LaborV2MoneyHistory> => {
  const [model, advances] = await Promise.all([getLaborV2ReadModel(db), listLaborV2PersonAdvances(db)]);
  const paymentIds = new Set(model.payments.map((item) => item.id));
  const advanceIds = new Set(advances.map((item) => item.id));
  const entries = [
    ...model.payments.map((payment) => ({ kind: 'payment' as const, id: payment.id, effectiveDate: payment.paymentDate, cashPaidSatang: payment.cashPaidSatang, payment })),
    ...advances.map((advance) => ({ kind: 'advance' as const, id: advance.id, effectiveDate: advance.advanceDate, amountSatang: advance.amountSatang, personId: advance.personId, advance })),
  ].sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate) || right.id.localeCompare(left.id));
  return {
    sourceVersion: 'v2',
    payments: model.payments,
    advances,
    events: model.events.filter((event) => paymentIds.has(event.entityId) || advanceIds.has(event.entityId)),
    entries,
  };
};
export const getPersonDetailV2 = async (db: SqlExecutor, personId: string): Promise<LaborV2PersonDetail> => {
  const model = await getLaborV2ReadModel(db); const [advances, paymentLinks] = await Promise.all([listLaborV2PersonAdvances(db, personId), db.getAllAsync<{ payment_session_id: string; obligation_id: string }>('SELECT settlement.payment_session_id, settlement.obligation_id FROM labor_v2_payment_recipient_settlements settlement JOIN labor_v2_payment_sessions session ON session.id = settlement.payment_session_id WHERE settlement.person_id = ? AND session.status IN (\'posted\', \'revised\')', [personId])]);
  const paymentIds = new Set(paymentLinks.map((row) => row.payment_session_id)); const advanceIds = new Set(advances.map((item) => item.id));
  return { sourceVersion: 'v2', personId, tasks: model.tasks.filter((task) => task.assigneePersonIds.includes(personId)), obligations: model.obligations.filter((item) => item.personId === personId), advances, payments: model.payments.filter((payment) => paymentIds.has(payment.id)).map((payment) => ({ ...payment, settledObligationIds: paymentLinks.filter((link) => link.payment_session_id === payment.id).map((link) => link.obligation_id) })), events: model.events.filter((event) => event.entityId === personId || advanceIds.has(event.entityId) || (event.entityType === 'payment_session' && paymentIds.has(event.entityId))) };
};
export const getLaborV2Person = async (db: SqlExecutor, personId: string): Promise<LaborV2PersonProjection> => getPersonDetailV2(db, personId);

/** Legacy V1 stays a labelled read-only boundary; callers must never total it with V2. */
export const getLegacyLaborRead = async (db: SqlExecutor): Promise<LegacyLaborRead> => ({ sourceVersion: 'v1', sourceLabel: 'ประวัติเดิม (V1, อ่านอย่างเดียว)', jobs: (await db.getAllAsync<{ id: string; work_date: string; title: string }>('SELECT id, work_date, title FROM labor_jobs ORDER BY work_date DESC, created_at DESC, id ASC')).map((row) => ({ id: row.id, workDate: row.work_date, title: row.title })) });
