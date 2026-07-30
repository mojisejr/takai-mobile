import type { SqlExecutor } from '../../data/migrations';
import type {
  CreateNormalWorkInput,
  EditLaborPaymentInput,
  LaborMvpReadModel,
  LaborPayable,
  LaborPayment,
  LaborPersonBalance,
  LaborTimelineEvent,
  LaborWorker,
  LaborWorkerInput,
  PaymentAllocationInput,
  PostLaborPaymentInput,
  UpdateLaborWorkerInput,
} from './types';

type PersonRow = { id: string; display_name: string; role: 'owner' | 'worker'; specialty: string; phone: string; note: string; archived_at: string | null; is_self: number };
type PayableRow = { id: string; labor_job_id: string; title: string; work_date: string; person_id: string; due_satang: number; paid_satang: number };
type PaymentRow = { id: string; person_id: string; payment_date: string; method: string; note: string; total_satang: number; current_revision: number };
type AllocationRow = { id: string; payable_id: string; amount_satang: number };
type TimelineRow = { id: string; entity_type: 'person' | 'labor_job' | 'labor_payment'; entity_id: string; action: string; occurred_at: string; reason: string | null; before_json: string | null; after_json: string; person_id: string | null; labor_job_id: string | null };

const timestamp = (): string => new Date().toISOString();
const generatedId = (prefix: string): string => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const trimmed = (value: string | undefined): string => (value ?? '').trim();

const assertPositiveSatang = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`TAKAI ${label} must be a positive INTEGER satang amount`);
};

const assertDate = (value: string, label: string): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`TAKAI ${label} must be YYYY-MM-DD`);
};

const withTransaction = async <T>(db: SqlExecutor, operation: () => Promise<T>): Promise<T> => {
  await db.execAsync('BEGIN IMMEDIATE');
  try {
    const result = await operation();
    await db.execAsync('COMMIT');
    return result;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

const activePerson = async (db: SqlExecutor, personId: string): Promise<PersonRow> => {
  const rows = await db.getAllAsync<PersonRow>(
    `SELECT id, display_name, role, specialty, phone, note, archived_at, is_self
     FROM people WHERE id = ? AND archived_at IS NULL LIMIT 1`,
    [personId],
  );
  if (!rows[0]) throw new Error(`TAKAI worker is unavailable: ${personId}`);
  return rows[0];
};

const activeWorker = async (db: SqlExecutor, personId: string): Promise<PersonRow> => {
  const person = await activePerson(db, personId);
  if (person.is_self || person.role !== 'worker') throw new Error(`TAKAI worker is unavailable: ${personId}`);
  return person;
};

const workerSnapshot = (person: PersonRow): LaborWorker => ({
  id: person.id,
  displayName: person.display_name,
  specialty: person.specialty,
  phone: person.phone,
  note: person.note,
  archivedAt: person.archived_at,
});

const payableRows = async (db: SqlExecutor, allocations: PaymentAllocationInput[]): Promise<Array<PayableRow & { allocation: PaymentAllocationInput }>> => {
  if (!allocations.length) throw new Error('TAKAI payment requires at least one allocation');
  const seen = new Set<string>();
  for (const allocation of allocations) {
    if (!trimmed(allocation.payableId) || seen.has(allocation.payableId)) throw new Error('TAKAI payment allocations must use distinct payable rows');
    seen.add(allocation.payableId);
    assertPositiveSatang(allocation.amountSatang, 'allocation');
  }
  const placeholders = allocations.map(() => '?').join(', ');
  const rows = await db.getAllAsync<PayableRow>(
    `SELECT payable.id, payable.labor_job_id, job.title, job.work_date, payable.person_id, payable.due_satang,
       COALESCE(SUM(CASE WHEN batch.status = 'posted' THEN allocation.amount_satang ELSE 0 END), 0) AS paid_satang
     FROM labor_payables AS payable
     JOIN labor_jobs AS job ON job.id = payable.labor_job_id
     LEFT JOIN labor_payment_allocations AS allocation ON allocation.payable_id = payable.id
     LEFT JOIN labor_payment_batches AS batch ON batch.id = allocation.payment_batch_id
     WHERE payable.id IN (${placeholders}) AND payable.status = 'open' AND job.status = 'open'
     GROUP BY payable.id`,
    allocations.map((allocation) => allocation.payableId),
  );
  if (rows.length !== allocations.length) throw new Error('TAKAI payable is unavailable for payment');
  const byId = new Map(rows.map((row) => [row.id, row]));
  return allocations.map((allocation) => ({ ...byId.get(allocation.payableId)!, allocation }));
};

const paymentSnapshot = async (db: SqlExecutor, paymentId: string): Promise<{ payment: LaborPayment; allocations: AllocationRow[] }> => {
  const rows = await db.getAllAsync<PaymentRow>(
    `SELECT id, person_id, payment_date, method, note, total_satang, current_revision
     FROM labor_payment_batches WHERE id = ? AND status = 'posted' LIMIT 1`,
    [paymentId],
  );
  if (!rows[0]) throw new Error(`TAKAI payment is unavailable: ${paymentId}`);
  const allocations = await db.getAllAsync<AllocationRow>(
    'SELECT id, payable_id, amount_satang FROM labor_payment_allocations WHERE payment_batch_id = ? ORDER BY id ASC',
    [paymentId],
  );
  return {
    payment: {
      id: rows[0].id,
      personId: rows[0].person_id,
      paymentDate: rows[0].payment_date,
      method: rows[0].method,
      note: rows[0].note,
      totalSatang: Number(rows[0].total_satang),
      currentRevision: Number(rows[0].current_revision),
      allocations: allocations.map((allocation) => ({ id: allocation.id, payableId: allocation.payable_id, amountSatang: Number(allocation.amount_satang) })),
    },
    allocations,
  };
};

const appendTimeline = async (db: SqlExecutor, input: Omit<LaborTimelineEvent, 'id'> & { id?: string }): Promise<void> => {
  await db.runAsync(
    `INSERT INTO timeline_events
     (id, entity_type, entity_id, action, occurred_at, reason, before_json, after_json, person_id, labor_job_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.id ?? generatedId('timeline'), input.entityType, input.entityId, input.action, input.occurredAt, input.reason, input.before == null ? null : JSON.stringify(input.before), JSON.stringify(input.after), input.personId, input.laborJobId],
  );
};

export const createLaborWorker = async (db: SqlExecutor, input: LaborWorkerInput, now = timestamp()): Promise<string> => {
  const displayName = trimmed(input.displayName);
  if (!displayName) throw new Error('TAKAI worker requires a display name');
  const id = input.id ?? generatedId('worker');
  await withTransaction(db, async () => {
    await db.runAsync(
      `INSERT INTO people (id, display_name, role, is_self, specialty, phone, note, archived_at)
       VALUES (?, ?, 'worker', 0, ?, ?, ?, NULL)`,
      [id, displayName, trimmed(input.specialty), trimmed(input.phone), trimmed(input.note)],
    );
    await appendTimeline(db, {
      entityType: 'person', entityId: id, action: 'worker_created', occurredAt: now, reason: null, before: null,
      after: { id, displayName, role: 'worker', specialty: trimmed(input.specialty), phone: trimmed(input.phone), note: trimmed(input.note) },
      personId: id, laborJobId: null,
    });
  });
  return id;
};

export const listLaborWorkers = async (db: SqlExecutor, includeArchived = false): Promise<LaborWorker[]> => {
  const rows = await db.getAllAsync<PersonRow>(
    `SELECT id, display_name, role, specialty, phone, note, archived_at, is_self
     FROM people WHERE role = 'worker' ${includeArchived ? '' : 'AND archived_at IS NULL'}
     ORDER BY archived_at IS NOT NULL ASC, display_name COLLATE NOCASE ASC`,
  );
  return rows.map(workerSnapshot);
};

export const updateLaborWorker = async (db: SqlExecutor, workerId: string, input: UpdateLaborWorkerInput, now = timestamp()): Promise<void> => {
  const reason = trimmed(input.reason);
  if (!reason) throw new Error('TAKAI worker update requires a reason');
  if (input.displayName !== undefined && !trimmed(input.displayName)) throw new Error('TAKAI worker requires a display name');
  if (input.displayName === undefined && input.specialty === undefined && input.phone === undefined && input.note === undefined) {
    throw new Error('TAKAI worker update requires a changed field');
  }
  await withTransaction(db, async () => {
    const before = await activeWorker(db, workerId);
    const after = {
      id: before.id,
      displayName: input.displayName === undefined ? before.display_name : trimmed(input.displayName),
      specialty: input.specialty === undefined ? before.specialty : trimmed(input.specialty),
      phone: input.phone === undefined ? before.phone : trimmed(input.phone),
      note: input.note === undefined ? before.note : trimmed(input.note),
      archivedAt: null,
    } satisfies LaborWorker;
    await db.runAsync(
      `UPDATE people SET display_name = ?, specialty = ?, phone = ?, note = ?
       WHERE id = ? AND role = 'worker' AND is_self = 0 AND archived_at IS NULL`,
      [after.displayName, after.specialty, after.phone, after.note, workerId],
    );
    await appendTimeline(db, {
      entityType: 'person', entityId: workerId, action: 'worker_updated', occurredAt: now, reason,
      before: workerSnapshot(before), after, personId: workerId, laborJobId: null,
    });
  });
};

export const archiveLaborWorker = async (db: SqlExecutor, workerId: string, reason: string, now = timestamp()): Promise<void> => {
  const trimmedReason = trimmed(reason);
  if (!trimmedReason) throw new Error('TAKAI worker archive requires a reason');
  await withTransaction(db, async () => {
    const before = await activeWorker(db, workerId);
    const after = { ...workerSnapshot(before), archivedAt: now };
    await db.runAsync(
      `UPDATE people SET archived_at = ?
       WHERE id = ? AND role = 'worker' AND is_self = 0 AND archived_at IS NULL`,
      [now, workerId],
    );
    await appendTimeline(db, {
      entityType: 'person', entityId: workerId, action: 'worker_archived', occurredAt: now, reason: trimmedReason,
      before: workerSnapshot(before), after, personId: workerId, laborJobId: null,
    });
  });
};

export const createNormalWork = async (db: SqlExecutor, input: CreateNormalWorkInput, now = timestamp()): Promise<{ jobId: string; payableIds: string[] }> => {
  const title = trimmed(input.title);
  if (!title) throw new Error('TAKAI normal work requires a title');
  assertDate(input.workDate, 'work date');
  if (!input.participants.length) throw new Error('TAKAI normal work requires at least one participant');
  const jobId = input.id ?? generatedId('labor-job');
  const participantIds = new Set<string>();
  const prepared = await Promise.all(input.participants.map(async (participant, index) => {
    if (!trimmed(participant.personId) || participantIds.has(participant.personId)) throw new Error('TAKAI normal work participants must be distinct');
    participantIds.add(participant.personId);
    const person = await activePerson(db, participant.personId);
    if (person.is_self) {
      if (participant.dueSatang != null && participant.dueSatang !== 0) throw new Error('TAKAI self participant cannot create a payable');
      return { participant, person, index, dueSatang: 0, payType: 'none' as const };
    }
    if (person.role !== 'worker') throw new Error(`TAKAI payable participant must be an active worker: ${participant.personId}`);
    if (participant.dueSatang == null) throw new Error('TAKAI worker participant requires due satang');
    assertPositiveSatang(participant.dueSatang, 'worker due');
    return { participant, person, index, dueSatang: participant.dueSatang, payType: participant.payType ?? 'daily' };
  }));
  return withTransaction(db, async () => {
    await db.runAsync(
      `INSERT INTO labor_jobs (id, title, work_date, plot_id, note, kind, status, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, 'normal', 'open', ?, ?)`,
      [jobId, title, input.workDate, trimmed(input.note), now, now],
    );
    const payableIds: string[] = [];
    for (const item of prepared) {
      const participantId = item.participant.participantId ?? `${jobId}-participant-${item.index + 1}`;
      await db.runAsync(
        `INSERT INTO labor_job_participants (id, labor_job_id, person_id, pay_type, sort_order, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [participantId, jobId, item.person.id, item.payType, item.index, trimmed(item.participant.note)],
      );
      if (item.dueSatang > 0) {
        const payableId = item.participant.payableId ?? `${jobId}-payable-${item.index + 1}`;
        await db.runAsync(
          `INSERT INTO labor_payables (id, labor_job_id, participant_id, person_id, due_satang, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'open', ?)`,
          [payableId, jobId, participantId, item.person.id, item.dueSatang, now],
        );
        payableIds.push(payableId);
      }
    }
    await appendTimeline(db, {
      entityType: 'labor_job', entityId: jobId, action: 'normal_work_created', occurredAt: now, reason: null,
      before: null,
      after: { id: jobId, title, workDate: input.workDate, plotId: null, kind: 'normal', participants: prepared.map((item) => ({ personId: item.person.id, dueSatang: item.dueSatang, payType: item.payType })) },
      personId: null, laborJobId: jobId,
    });
    return { jobId, payableIds };
  });
};

export const postLaborPayment = async (db: SqlExecutor, input: PostLaborPaymentInput, now = timestamp()): Promise<string> => {
  assertDate(input.paymentDate, 'payment date');
  await activeWorker(db, input.personId);
  const paymentId = input.id ?? generatedId('labor-payment');
  return withTransaction(db, async () => {
    const rows = await payableRows(db, input.allocations);
    for (const row of rows) {
      if (row.person_id !== input.personId) throw new Error('TAKAI payment payee must match every payable');
      if (row.allocation.amountSatang > Number(row.due_satang) - Number(row.paid_satang)) throw new Error('TAKAI payment allocation cannot exceed payable remaining balance');
    }
    const totalSatang = rows.reduce((sum, row) => sum + row.allocation.amountSatang, 0);
    await db.runAsync(
      `INSERT INTO labor_payment_batches (id, person_id, payment_date, method, note, total_satang, current_revision, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 'posted', ?, ?)`,
      [paymentId, input.personId, input.paymentDate, trimmed(input.method), trimmed(input.note), totalSatang, now, now],
    );
    for (const [index, row] of rows.entries()) {
      await db.runAsync(
        'INSERT INTO labor_payment_allocations (id, payment_batch_id, payable_id, amount_satang) VALUES (?, ?, ?, ?)',
        [row.allocation.id ?? `${paymentId}-allocation-${index + 1}`, paymentId, row.id, row.allocation.amountSatang],
      );
    }
    const snapshot = await paymentSnapshot(db, paymentId);
    await appendTimeline(db, {
      entityType: 'labor_payment', entityId: paymentId, action: 'payment_posted', occurredAt: now, reason: null,
      before: null, after: snapshot.payment, personId: input.personId, laborJobId: null,
    });
    return paymentId;
  });
};

export const editLaborPayment = async (db: SqlExecutor, paymentId: string, input: EditLaborPaymentInput, now = timestamp()): Promise<void> => {
  const reason = trimmed(input.reason);
  if (!reason) throw new Error('TAKAI payment edit requires a reason');
  assertDate(input.paymentDate, 'payment date');
  await withTransaction(db, async () => {
    const before = await paymentSnapshot(db, paymentId);
    await activeWorker(db, before.payment.personId);
    const rows = await payableRows(db, input.allocations);
    for (const row of rows) {
      if (row.person_id !== before.payment.personId) throw new Error('TAKAI payment payee must match every payable');
      const previousAllocation = before.allocations.find((allocation) => allocation.payable_id === row.id)?.amount_satang ?? 0;
      const alreadyPaidOutsideThisPayment = Number(row.paid_satang) - Number(previousAllocation);
      if (row.allocation.amountSatang > Number(row.due_satang) - alreadyPaidOutsideThisPayment) throw new Error('TAKAI payment allocation cannot exceed payable remaining balance');
    }
    const totalSatang = rows.reduce((sum, row) => sum + row.allocation.amountSatang, 0);
    await db.runAsync(
      `UPDATE labor_payment_batches
       SET payment_date = ?, method = ?, note = ?, total_satang = ?, current_revision = current_revision + 1, updated_at = ?
       WHERE id = ? AND status = 'posted'`,
      [input.paymentDate, trimmed(input.method), trimmed(input.note), totalSatang, now, paymentId],
    );
    await db.runAsync('DELETE FROM labor_payment_allocations WHERE payment_batch_id = ?', [paymentId]);
    for (const [index, row] of rows.entries()) {
      await db.runAsync(
        'INSERT INTO labor_payment_allocations (id, payment_batch_id, payable_id, amount_satang) VALUES (?, ?, ?, ?)',
        [row.allocation.id ?? `${paymentId}-revision-${before.payment.currentRevision + 1}-${index + 1}`, paymentId, row.id, row.allocation.amountSatang],
      );
    }
    const after = await paymentSnapshot(db, paymentId);
    await appendTimeline(db, {
      entityType: 'labor_payment', entityId: paymentId, action: 'payment_edited', occurredAt: now, reason,
      before: before.payment, after: after.payment, personId: before.payment.personId, laborJobId: null,
    });
  });
};

export const listLaborPayables = async (db: SqlExecutor, personId?: string): Promise<LaborPayable[]> => {
  const rows = await db.getAllAsync<PayableRow>(
    `SELECT payable.id, payable.labor_job_id, job.title, job.work_date, payable.person_id, payable.due_satang,
       COALESCE(SUM(CASE WHEN batch.status = 'posted' THEN allocation.amount_satang ELSE 0 END), 0) AS paid_satang
     FROM labor_payables AS payable
     JOIN labor_jobs AS job ON job.id = payable.labor_job_id
     LEFT JOIN labor_payment_allocations AS allocation ON allocation.payable_id = payable.id
     LEFT JOIN labor_payment_batches AS batch ON batch.id = allocation.payment_batch_id
     WHERE payable.status = 'open' AND job.status = 'open' ${personId ? 'AND payable.person_id = ?' : ''}
     GROUP BY payable.id ORDER BY job.work_date DESC, payable.created_at DESC`,
    personId ? [personId] : [],
  );
  return rows.map((row) => ({ id: row.id, jobId: row.labor_job_id, jobTitle: row.title, workDate: row.work_date, personId: row.person_id, dueSatang: Number(row.due_satang), paidSatang: Number(row.paid_satang), remainingSatang: Number(row.due_satang) - Number(row.paid_satang) }));
};

export const listLaborPayments = async (db: SqlExecutor, personId?: string): Promise<LaborPayment[]> => {
  const rows = await db.getAllAsync<PaymentRow>(
    `SELECT id, person_id, payment_date, method, note, total_satang, current_revision
     FROM labor_payment_batches WHERE status = 'posted' ${personId ? 'AND person_id = ?' : ''}
     ORDER BY payment_date DESC, created_at DESC`,
    personId ? [personId] : [],
  );
  return Promise.all(rows.map(async (row) => ({ ...(await paymentSnapshot(db, row.id)).payment })));
};

export const listLaborTimeline = async (db: SqlExecutor, entityId?: string): Promise<LaborTimelineEvent[]> => {
  const rows = await db.getAllAsync<TimelineRow>(
    `SELECT id, entity_type, entity_id, action, occurred_at, reason, before_json, after_json, person_id, labor_job_id
     FROM timeline_events ${entityId ? 'WHERE entity_id = ?' : ''} ORDER BY occurred_at ASC, id ASC`,
    entityId ? [entityId] : [],
  );
  return rows.map((row) => ({ id: row.id, entityType: row.entity_type, entityId: row.entity_id, action: row.action, occurredAt: row.occurred_at, reason: row.reason, before: row.before_json ? JSON.parse(row.before_json) : null, after: JSON.parse(row.after_json), personId: row.person_id, laborJobId: row.labor_job_id }));
};

export const getLaborMvpReadModel = async (db: SqlExecutor): Promise<LaborMvpReadModel> => {
  const [workers, payables, payments, timeline] = await Promise.all([listLaborWorkers(db, true), listLaborPayables(db), listLaborPayments(db), listLaborTimeline(db)]);
  const people: LaborPersonBalance[] = workers.map((worker) => {
    const rows = payables.filter((payable) => payable.personId === worker.id);
    return { ...worker, dueSatang: rows.reduce((sum, row) => sum + row.dueSatang, 0), paidSatang: rows.reduce((sum, row) => sum + row.paidSatang, 0), remainingSatang: rows.reduce((sum, row) => sum + row.remainingSatang, 0) };
  });
  return { people, payables, payments, timeline };
};
