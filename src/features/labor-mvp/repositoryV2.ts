import type { SqlExecutor } from '../../data/migrations';
import { planLaborCompensationV2 } from './compensationV2';
import type { CorrectLaborV2PaymentSessionInput, FinalizeLaborContractBatchV2Input, LaborV2CalendarDay, LaborV2PersonProjection, LaborV2ReadModel, PostLaborV2PaymentSessionInput, RecordLaborContractProgressV2Input, RecordLaborDayV2Input, StartLaborContractBatchV2Input } from './types';

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

export const recordLaborDayV2 = async (db: SqlExecutor, input: RecordLaborDayV2Input, occurredAt = now()): Promise<{ taskIds: string[]; dailyUnitIds: string[]; hourlyShiftIds: string[] }> => transaction(db, async () => {
  date(input.workDate, 'work date');
  const taskFacts = input.tasks.map((task, index) => ({ id: task.id ?? `labor-v2-task-${index + 1}-${id('')}`, workDate: input.workDate, title: task.title, note: task.note, assigneePersonIds: task.assigneePersonIds }));
  const daily = (input.daily ?? []).map((unit, index) => ({ id: unit.id ?? `labor-v2-daily-${index + 1}-${id('')}`, ...unit, workDate: input.workDate }));
  const hourly = (input.hourly ?? []).map((entry, index) => ({ id: entry.id ?? `labor-v2-hourly-${index + 1}-${id('')}`, ...entry, workDate: input.workDate }));
  const plan = planLaborCompensationV2({ tasks: taskFacts, daily, hourly, contracts: [] });
  for (const task of taskFacts) for (const personId of task.assigneePersonIds) await worker(db, personId);
  for (const task of taskFacts) {
    await db.runAsync('INSERT INTO labor_v2_work_tasks (id, work_date, title, note, created_at) VALUES (?, ?, ?, ?, ?)', [task.id, task.workDate, text(task.title), text(task.note), occurredAt]);
    for (const [sort, personId] of task.assigneePersonIds.entries()) await db.runAsync('INSERT INTO labor_v2_task_assignments (id, task_id, person_id, sort_order, note) VALUES (?, ?, ?, ?, ?)', [id('labor-v2-assignment'), task.id, personId, sort, '']);
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
  const [tasks, obligations, payments, events] = await Promise.all([
    db.getAllAsync<{ id: string; work_date: string; title: string }>('SELECT id, work_date, title FROM labor_v2_work_tasks ORDER BY work_date DESC, id ASC'),
    db.getAllAsync<{ id: string; source_kind: 'daily' | 'hourly' | 'contract'; source_unit_id: string; recipient_kind: 'person' | 'group'; person_id: string | null; due_satang: number; paid_satang: number }>("SELECT obligation.id, obligation.source_kind, obligation.source_unit_id, obligation.recipient_kind, obligation.person_id, obligation.due_satang, COALESCE((SELECT SUM(settlement.wage_satang) FROM labor_v2_payment_recipient_settlements settlement JOIN labor_v2_payment_sessions session ON session.id = settlement.payment_session_id WHERE settlement.obligation_id = obligation.id AND session.status IN ('posted', 'revised')), 0) AS paid_satang FROM labor_v2_obligations obligation WHERE obligation.status != 'cancelled' ORDER BY obligation.created_at ASC"),
    db.getAllAsync<{ id: string; payment_date: string; method: string; cash_paid_satang: number; current_revision: number }>("SELECT id, payment_date, method, cash_paid_satang, current_revision FROM labor_v2_payment_sessions WHERE status IN ('posted', 'revised') ORDER BY payment_date DESC, created_at DESC"),
    db.getAllAsync<{ id: string; entity_type: string; entity_id: string; action: string; reason: string | null; occurred_at: string }>('SELECT id, entity_type, entity_id, action, reason, occurred_at FROM labor_v2_event_history ORDER BY occurred_at ASC, id ASC'),
  ]);
  const assignees = await db.getAllAsync<{ task_id: string; person_id: string }>('SELECT task_id, person_id FROM labor_v2_task_assignments ORDER BY sort_order ASC, id ASC');
  return { sourceVersion: 'v2', tasks: tasks.map((task) => ({ id: task.id, workDate: task.work_date, title: task.title, assigneePersonIds: assignees.filter((entry) => entry.task_id === task.id).map((entry) => entry.person_id) })), obligations: obligations.map((item) => ({ id: item.id, sourceKind: item.source_kind, sourceUnitId: item.source_unit_id, recipientKind: item.recipient_kind, personId: item.person_id, dueSatang: Number(item.due_satang), paidSatang: Number(item.paid_satang), remainingSatang: Number(item.due_satang) - Number(item.paid_satang), status: Number(item.due_satang) === Number(item.paid_satang) ? 'settled' : 'open' })), payments: payments.map((item) => ({ id: item.id, paymentDate: item.payment_date, method: item.method, cashPaidSatang: Number(item.cash_paid_satang), currentRevision: Number(item.current_revision) })), events: events.map((item) => ({ id: item.id, entityType: item.entity_type, entityId: item.entity_id, action: item.action, reason: item.reason, occurredAt: item.occurred_at })) };
};

/** Typed V2 read seams for Today, calendar, history, person, unpaid, and money history. */
export const getLaborV2Today = async (db: SqlExecutor, workDate: string): Promise<{ sourceVersion: 'v2'; date: string; tasks: LaborV2ReadModel['tasks']; unpaid: LaborV2ReadModel['obligations'] }> => {
  date(workDate, 'today date'); const model = await getLaborV2ReadModel(db);
  return { sourceVersion: 'v2', date: workDate, tasks: model.tasks.filter((task) => task.workDate === workDate), unpaid: model.obligations.filter((item) => item.remainingSatang > 0) };
};

export const getLaborV2Calendar = async (db: SqlExecutor, startDate: string, endDate: string): Promise<{ sourceVersion: 'v2'; days: LaborV2CalendarDay[] }> => {
  date(startDate, 'calendar start'); date(endDate, 'calendar end'); if (startDate > endDate) throw new Error('TAKAI V2 calendar start must not follow end'); const model = await getLaborV2ReadModel(db); const grouped = new Map<string, LaborV2CalendarDay>();
  for (const task of model.tasks.filter((item) => item.workDate >= startDate && item.workDate <= endDate)) { const day = grouped.get(task.workDate) ?? { workDate: task.workDate, taskCount: 0, taskIds: [] }; day.taskCount += 1; day.taskIds.push(task.id); grouped.set(task.workDate, day); }
  return { sourceVersion: 'v2', days: [...grouped.values()].sort((left, right) => left.workDate.localeCompare(right.workDate)) };
};

export const getLaborV2History = async (db: SqlExecutor): Promise<LaborV2ReadModel['events']> => (await getLaborV2ReadModel(db)).events;
export const getLaborV2Unpaid = async (db: SqlExecutor): Promise<LaborV2ReadModel['obligations']> => (await getLaborV2ReadModel(db)).obligations.filter((item) => item.remainingSatang > 0);
export const getLaborV2MoneyHistory = async (db: SqlExecutor): Promise<LaborV2ReadModel['payments']> => (await getLaborV2ReadModel(db)).payments;
export const getLaborV2Person = async (db: SqlExecutor, personId: string): Promise<LaborV2PersonProjection> => { const model = await getLaborV2ReadModel(db); return { sourceVersion: 'v2', personId, tasks: model.tasks.filter((task) => task.assigneePersonIds.includes(personId)), obligations: model.obligations.filter((item) => item.personId === personId), payments: model.payments, events: model.events.filter((item) => item.entityId === personId || item.entityType === 'payment_session') }; };
