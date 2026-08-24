import type { SqlExecutor } from '../../data/migrations';
import { localDateKey } from '../../date';
import type {
  AddContractProgressInput,
  ApplyLaborAdvanceDeductionInput,
  CompleteLaborContractWorkInput,
  ContractParticipantInput,
  CreateLaborContractInput,
  CreateGroupPieceWorkInput,
  CreateLaborWorkerAdvanceInput,
  CreateLaborSettlementGroupInput,
  CreateManualOpeningBalanceInput,
  CreateNormalWorkInput,
  EditLaborPaymentInput,
  EditLaborWorkerAdvanceInput,
  EditLaborSettlementGroupReceiptInput,
  ImportLegacyLaborEntriesInput,
  LaborContract,
  LaborContractProgress,
  LaborCalendarDaySummary,
  LaborCalendarRange,
  LaborCalendarRangeInput,
  LaborAdvanceDeduction,
  LaborHistory,
  LaborHistoryInput,
  LaborJobDetail,
  LegacyCarryForwardBalance,
  LegacyLaborSource,
  LaborMvpReadModel,
  LaborPayable,
  LaborPayType,
  LaborPayment,
  LaborPaymentSession,
  LaborPaymentSessionSettlement,
  LaborPaymentState,
  LaborPersonDetail,
  LaborWorkerAdvance,
  LaborProjectionEvent,
  LaborProjectionEventType,
  LaborSettlementGroup,
  LaborSettlementGroupReceipt,
  LaborSettlementRoute,
  LaborWorkBasisSnapshot,
  LaborPersonBalance,
  LaborTimelineEvent,
  LaborTodaySummary,
  LaborWorker,
  LaborWorkerInput,
  PaymentAllocationInput,
  PaymentSessionAdvanceRecoveryInput,
  PostLaborPaymentSessionInput,
  CorrectLaborPaymentSessionInput,
  PostLaborPaymentInput,
  PostLaborSettlementGroupReceiptInput,
  RecordedLaborWorkItem,
  RecordLaborWorkItemsInput,
  ReconcileContractSharesInput,
  UpdateLaborWorkerInput,
} from './types';

type PersonRow = { id: string; display_name: string; role: 'owner' | 'worker'; specialty: string; phone: string; note: string; archived_at: string | null; is_self: number };
type PayableRow = { id: string; labor_job_id: string; title: string; work_date: string; person_id: string; due_satang: number; paid_satang: number; recovered_satang: number; kind: 'normal' | 'contract' | 'legacy_import' };
type PaymentRow = { id: string; person_id: string; payment_date: string; method: string; note: string; total_satang: number; current_revision: number };
type AllocationRow = { id: string; payable_id: string; amount_satang: number };
type TimelineRow = { id: string; entity_type: 'person' | 'labor_job' | 'labor_payment'; entity_id: string; action: string; occurred_at: string; reason: string | null; before_json: string | null; after_json: string; person_id: string | null; labor_job_id: string | null };
type ContractJobRow = { id: string; title: string; work_date: string; note: string; starts_on: string | null; deadline_on: string | null; completed_on: string | null; status: 'in_progress' | 'awaiting_amount' | 'completed' | 'cancelled'; agreed_total_satang: number | null; final_total_satang: number | null };
type LegacySourceRow = { id: string; person_id: string; work_date: string; amount_due: number; amount_paid: number; imported_at: string | null };
type SettlementGroupRow = { id: string; labor_job_id: string; original_due_satang: number; status: 'open' | 'settled' | 'cancelled'; collector_person_id: string | null; collector_label: string; paid_satang: number };
type SettlementGroupReceiptRow = { id: string; settlement_group_id: string; receipt_date: string; amount_satang: number; method: string; note: string; current_revision: number; status: 'posted' | 'revised' | 'cancelled' };
type WorkBasisSnapshotRow = { id: string; labor_job_id: string; settlement_route: LaborSettlementRoute; basis_kind: 'daily' | 'hourly' | 'piece' | 'contract'; stage: 'recorded' | 'started' | 'progress' | 'completed'; person_id: string | null; rate_satang: number | null; quantity_milli: number | null; duration_minutes: number | null; unit_label: string; total_satang: number | null; note: string; created_at: string };
type AdvanceRow = { id: string; person_id: string; advance_date: string; amount_satang: number; method: string; note: string; current_revision: number; status: 'posted' | 'revised' | 'cancelled'; recovered_satang: number };
type AdvanceDeductionRow = { id: string; labor_worker_advance_id: string; labor_payable_id: string; person_id: string; recovery_date: string; amount_satang: number; note: string };
type PaymentSessionRow = { id: string; payment_date: string; method: string; note: string; cash_paid_satang: number; current_revision: number; status: 'posted' | 'revised' | 'cancelled'; created_at: string };
type PaymentSessionSettlementRow = { id: string; payment_session_id: string; recipient_type: 'person' | 'group'; person_id: string | null; settlement_group_id: string | null; wage_satang: number; bonus_satang: number; advance_recovered_satang: number; cash_paid_satang: number };
type PaymentSessionWageAllocationRow = { id: string; settlement_id: string; labor_payable_id: string; amount_satang: number };
type PaymentSessionAdvanceRecoveryRow = { id: string; settlement_id: string; labor_worker_advance_id: string; labor_payable_id: string; amount_satang: number };

const timestamp = (): string => new Date().toISOString();
const generatedId = (prefix: string): string => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const trimmed = (value: string | undefined): string => (value ?? '').trim();

const assertPositiveSatang = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`TAKAI ${label} must be a positive INTEGER satang amount`);
};

const assertPositiveQuantityMilli = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`TAKAI ${label} must be a positive INTEGER milli-unit quantity`);
};

const dueForRateAndQuantity = (rateSatang: number, quantityMilli: number, label: string): number => {
  assertPositiveSatang(rateSatang, `${label} rate`);
  assertPositiveQuantityMilli(quantityMilli, `${label} quantity`);
  const multiplied = rateSatang * quantityMilli;
  if (!Number.isSafeInteger(multiplied) || multiplied % 1000 !== 0) throw new Error(`TAKAI ${label} rate and quantity must resolve to whole satang`);
  return multiplied / 1000;
};

const dueForHourlyRateAndDuration = (rateSatang: number, durationMinutes: number, label: string): number => {
  assertPositiveSatang(rateSatang, `${label} rate`);
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes <= 0) throw new Error(`TAKAI ${label} duration must be positive whole minutes`);
  const multiplied = rateSatang * durationMinutes;
  if (!Number.isSafeInteger(multiplied) || multiplied % 60 !== 0) throw new Error(`TAKAI ${label} rate and duration must resolve to whole satang`);
  return multiplied / 60;
};

const assertDate = (value: string, label: string): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`TAKAI ${label} must be YYYY-MM-DD`);
};

const bahtToSatang = (value: number, label: string): number => {
  if (!Number.isFinite(value)) throw new Error(`TAKAI ${label} must be a finite baht amount`);
  const satang = Math.round(value * 100);
  if (!Number.isSafeInteger(satang) || Math.abs(value * 100 - satang) > 0.000001) {
    throw new Error(`TAKAI ${label} cannot be represented safely in satang`);
  }
  return satang;
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

const advanceRows = async (db: SqlExecutor, personId?: string): Promise<AdvanceRow[]> => db.getAllAsync<AdvanceRow>(
  `SELECT advance.id, advance.person_id, advance.advance_date, advance.amount_satang, advance.method, advance.note,
          advance.current_revision, advance.status,
          COALESCE((SELECT SUM(deduction.amount_satang)
            FROM labor_advance_deductions AS deduction
            WHERE deduction.labor_worker_advance_id = advance.id), 0)
          + COALESCE((SELECT SUM(recovery.amount_satang)
            FROM labor_payment_session_advance_recoveries AS recovery
            JOIN labor_payment_session_settlements AS settlement ON settlement.id = recovery.settlement_id
            JOIN labor_payment_sessions AS session ON session.id = settlement.payment_session_id
            WHERE recovery.labor_worker_advance_id = advance.id AND session.status IN ('posted', 'revised')), 0)
          + COALESCE((SELECT SUM(recovery.amount_satang)
            FROM labor_v2_payment_advance_recoveries AS recovery
            JOIN labor_v2_payment_recipient_settlements AS settlement ON settlement.id = recovery.recipient_settlement_id
            JOIN labor_v2_payment_sessions AS session ON session.id = settlement.payment_session_id
            WHERE recovery.labor_worker_advance_id = advance.id AND session.status IN ('posted', 'revised')), 0) AS recovered_satang
   FROM labor_worker_advances AS advance
   WHERE advance.status IN ('posted', 'revised') ${personId ? 'AND advance.person_id = ?' : ''}
   ORDER BY advance.advance_date DESC, advance.created_at DESC, advance.id DESC`,
  personId ? [personId] : [],
);

const advanceSnapshot = async (db: SqlExecutor, advanceId: string): Promise<LaborWorkerAdvance> => {
  const row = (await advanceRows(db)).find((item) => item.id === advanceId);
  if (!row) throw new Error(`TAKAI worker advance is unavailable: ${advanceId}`);
  const recoveredSatang = Number(row.recovered_satang);
  return {
    id: row.id, personId: row.person_id, advanceDate: row.advance_date, amountSatang: Number(row.amount_satang),
    recoveredSatang, remainingSatang: Number(row.amount_satang) - recoveredSatang, method: row.method,
    note: row.note, currentRevision: Number(row.current_revision), status: row.status,
  };
};

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
    `SELECT payable.id, payable.labor_job_id, job.title, job.work_date, job.kind, payable.person_id, payable.due_satang,
       COALESCE((SELECT SUM(allocation.amount_satang)
        FROM labor_payment_allocations AS allocation
        JOIN labor_payment_batches AS batch ON batch.id = allocation.payment_batch_id
        WHERE allocation.payable_id = payable.id AND batch.status = 'posted'), 0)
       + COALESCE((SELECT SUM(session_allocation.amount_satang)
        FROM labor_payment_session_wage_allocations AS session_allocation
       JOIN labor_payment_session_settlements AS settlement ON settlement.id = session_allocation.settlement_id
       JOIN labor_payment_sessions AS session ON session.id = settlement.payment_session_id
        WHERE session_allocation.labor_payable_id = payable.id AND session.status IN ('posted', 'revised')), 0)
       - COALESCE((SELECT SUM(recovery.amount_satang)
        FROM labor_payment_session_advance_recoveries AS recovery
        JOIN labor_payment_session_settlements AS settlement ON settlement.id = recovery.settlement_id
        JOIN labor_payment_sessions AS session ON session.id = settlement.payment_session_id
        WHERE recovery.labor_payable_id = payable.id AND session.status IN ('posted', 'revised')), 0) AS paid_satang,
       COALESCE((SELECT SUM(deduction.amount_satang)
        FROM labor_advance_deductions AS deduction
        WHERE deduction.labor_payable_id = payable.id), 0)
       + COALESCE((SELECT SUM(recovery.amount_satang)
        FROM labor_payment_session_advance_recoveries AS recovery
        JOIN labor_payment_session_settlements AS settlement ON settlement.id = recovery.settlement_id
        JOIN labor_payment_sessions AS session ON session.id = settlement.payment_session_id
        WHERE recovery.labor_payable_id = payable.id AND session.status IN ('posted', 'revised')), 0) AS recovered_satang
     FROM labor_payables AS payable
     JOIN labor_jobs AS job ON job.id = payable.labor_job_id
     WHERE payable.id IN (${placeholders}) AND payable.status = 'open' AND job.status = 'open'
    `,
    allocations.map((allocation) => allocation.payableId),
  );
  if (rows.length !== allocations.length) throw new Error('TAKAI payable is unavailable for payment');
  const byId = new Map(rows.map((row) => [row.id, row]));
  return allocations.map((allocation) => ({ ...byId.get(allocation.payableId)!, allocation }));
};

const assertContractPayablesReadyForSettlement = async (db: SqlExecutor, rows: PayableRow[]): Promise<void> => {
  const contractJobIds = [...new Set(rows.filter((row) => row.kind === 'contract').map((row) => row.labor_job_id))];
  for (const jobId of contractJobIds) {
    const details = await db.getAllAsync<{ total_satang: number | null; share_total_satang: number; status: string }>(
      `SELECT COALESCE(detail.final_total_satang, detail.agreed_total_satang) AS total_satang,
         COALESCE((SELECT SUM(due_satang) FROM labor_payables WHERE labor_job_id = job.id AND status = 'open'), 0) AS share_total_satang,
         detail.status
       FROM labor_jobs AS job
       LEFT JOIN labor_contract_details AS detail ON detail.labor_job_id = job.id
       WHERE job.id = ? AND job.kind = 'contract' AND job.status = 'open' LIMIT 1`,
      [jobId],
    );
    const detail = details[0];
    if (!detail || detail.total_satang == null || Number(detail.total_satang) <= 0 || Number(detail.share_total_satang) !== Number(detail.total_satang) || detail.status === 'cancelled') {
      throw new Error('TAKAI contract payment requires reconciled total and shares');
    }
  }
};

const contractJob = async (db: SqlExecutor, jobId: string): Promise<ContractJobRow> => {
  const rows = await db.getAllAsync<ContractJobRow>(
    `SELECT job.id, job.title, job.work_date, job.note, detail.starts_on, detail.deadline_on, detail.completed_on,
       detail.status, detail.agreed_total_satang, detail.final_total_satang
     FROM labor_jobs AS job
     JOIN labor_contract_details AS detail ON detail.labor_job_id = job.id
     WHERE job.id = ? AND job.kind = 'contract' AND job.status = 'open' LIMIT 1`,
    [jobId],
  );
  if (!rows[0]) throw new Error(`TAKAI contract is unavailable: ${jobId}`);
  return rows[0];
};

const assertContractParticipants = async (db: SqlExecutor, participants: ContractParticipantInput[]): Promise<Array<{ input: ContractParticipantInput; person: PersonRow; index: number }>> => {
  if (participants.length === 0) throw new Error('TAKAI contract requires at least one worker participant');
  const seen = new Set<string>();
  return Promise.all(participants.map(async (input, index) => {
    if (!trimmed(input.personId) || seen.has(input.personId)) throw new Error('TAKAI contract participants must be distinct');
    seen.add(input.personId);
    return { input, person: await activeWorker(db, input.personId), index };
  }));
};

const hasContractPayment = async (db: SqlExecutor, jobId: string): Promise<boolean> => Boolean((await db.getAllAsync<{ id: string }>(
  `SELECT allocation.id
   FROM labor_payment_allocations AS allocation
   JOIN labor_payment_batches AS batch ON batch.id = allocation.payment_batch_id
   JOIN labor_payables AS payable ON payable.id = allocation.payable_id
   WHERE payable.labor_job_id = ? AND batch.status = 'posted' LIMIT 1`,
  [jobId],
))[0]);

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

const settlementGroupRows = async (db: SqlExecutor, jobId?: string): Promise<SettlementGroupRow[]> => db.getAllAsync<SettlementGroupRow>(
  `SELECT settlement_group.id, settlement_group.labor_job_id, settlement_group.original_due_satang, settlement_group.status,
     settlement_group.collector_person_id, settlement_group.collector_label,
     COALESCE(SUM(CASE WHEN receipt.status IN ('posted', 'revised') THEN receipt.amount_satang ELSE 0 END), 0)
     + COALESCE((SELECT SUM(session_settlement.wage_satang)
        FROM labor_payment_session_settlements AS session_settlement
        JOIN labor_payment_sessions AS session ON session.id = session_settlement.payment_session_id
        WHERE session_settlement.settlement_group_id = settlement_group.id
          AND session_settlement.recipient_type = 'group'
          AND session.status IN ('posted', 'revised')), 0) AS paid_satang
   FROM labor_settlement_groups AS settlement_group
   LEFT JOIN labor_settlement_group_receipts AS receipt ON receipt.settlement_group_id = settlement_group.id
   ${jobId ? 'WHERE settlement_group.labor_job_id = ?' : ''}
   GROUP BY settlement_group.id
   ORDER BY settlement_group.created_at ASC, settlement_group.id ASC`,
  jobId ? [jobId] : [],
);

const settlementGroupReceiptRows = async (db: SqlExecutor, settlementGroupId: string): Promise<SettlementGroupReceiptRow[]> => db.getAllAsync<SettlementGroupReceiptRow>(
  `SELECT id, settlement_group_id, receipt_date, amount_satang, method, note, current_revision, status
   FROM labor_settlement_group_receipts
   WHERE settlement_group_id = ? ORDER BY receipt_date ASC, created_at ASC, id ASC`,
  [settlementGroupId],
);

const settlementGroupSnapshot = async (db: SqlExecutor, settlementGroupId: string): Promise<LaborSettlementGroup> => {
  const group = (await settlementGroupRows(db)).find((item) => item.id === settlementGroupId);
  if (!group) throw new Error(`TAKAI settlement group is unavailable: ${settlementGroupId}`);
  const [members, receipts] = await Promise.all([
    db.getAllAsync<{ person_id: string }>(
      `SELECT participant.person_id
       FROM labor_settlement_group_members AS member
       JOIN labor_job_participants AS participant ON participant.id = member.participant_id
       WHERE member.settlement_group_id = ? ORDER BY member.sort_order ASC, member.id ASC`,
      [settlementGroupId],
    ),
    settlementGroupReceiptRows(db, settlementGroupId),
  ]);
  const paidSatang = Number(group.paid_satang);
  return {
    id: group.id,
    jobId: group.labor_job_id,
    originalDueSatang: Number(group.original_due_satang),
    paidSatang,
    remainingSatang: Number(group.original_due_satang) - paidSatang,
    status: group.status,
    collectorPersonId: group.collector_person_id,
    collectorLabel: group.collector_label,
    memberPersonIds: members.map((member) => member.person_id),
    receipts: receipts.map((receipt): LaborSettlementGroupReceipt => ({
      id: receipt.id,
      settlementGroupId: receipt.settlement_group_id,
      receiptDate: receipt.receipt_date,
      amountSatang: Number(receipt.amount_satang),
      method: receipt.method,
      note: receipt.note,
      currentRevision: Number(receipt.current_revision),
      status: receipt.status,
    })),
  };
};

const assertJobAllowsSettlementGroup = async (db: SqlExecutor, laborJobId: string): Promise<void> => {
  const job = (await db.getAllAsync<{ id: string }>(
    "SELECT id FROM labor_jobs WHERE id = ? AND status = 'open' LIMIT 1",
    [laborJobId],
  ))[0];
  if (!job) throw new Error(`TAKAI labor job is unavailable for settlement group: ${laborJobId}`);
  const [existingPayable, existingGroup] = await Promise.all([
    db.getAllAsync<{ id: string }>('SELECT id FROM labor_payables WHERE labor_job_id = ? AND status = \'open\' LIMIT 1', [laborJobId]),
    db.getAllAsync<{ id: string }>('SELECT id FROM labor_settlement_groups WHERE labor_job_id = ? LIMIT 1', [laborJobId]),
  ]);
  if (existingPayable[0]) throw new Error('TAKAI settlement group cannot mix with individual payables for one job');
  if (existingGroup[0]) throw new Error('TAKAI labor job already has a settlement group');
};

const appendWorkBasisSnapshot = async (db: SqlExecutor, input: Omit<LaborWorkBasisSnapshot, 'id'> & { id?: string }): Promise<string> => {
  const id = input.id ?? generatedId('work-basis');
  if (input.basisKind === 'hourly') {
    if (input.rateSatang == null || input.durationMinutes == null || input.totalSatang == null) {
      throw new Error('TAKAI hourly work basis requires rate, duration minutes, and total');
    }
    await db.runAsync(
      `INSERT INTO labor_hourly_work_basis_snapshots
       (id, labor_job_id, settlement_route, stage, person_id, rate_satang, duration_minutes, unit_label, total_satang, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.jobId, input.settlementRoute, input.stage, input.personId, input.rateSatang, input.durationMinutes, input.unitLabel, input.totalSatang, input.note, input.createdAt],
    );
    return id;
  }
  await db.runAsync(
    `INSERT INTO labor_work_basis_snapshots
     (id, labor_job_id, settlement_route, basis_kind, stage, person_id, rate_satang, quantity_milli, unit_label, total_satang, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.jobId, input.settlementRoute, input.basisKind, input.stage, input.personId, input.rateSatang, input.quantityMilli, input.unitLabel, input.totalSatang, input.note, input.createdAt],
  );
  return id;
};

const workBasisSnapshotsForJob = async (db: SqlExecutor, jobId: string): Promise<LaborWorkBasisSnapshot[]> => {
  const rows = await db.getAllAsync<WorkBasisSnapshotRow>(
    `SELECT id, labor_job_id, settlement_route, basis_kind, stage, person_id, rate_satang, quantity_milli,
            NULL AS duration_minutes, unit_label, total_satang, note, created_at
     FROM labor_work_basis_snapshots WHERE labor_job_id = ?
     UNION ALL
     SELECT id, labor_job_id, settlement_route, 'hourly' AS basis_kind, stage, person_id, rate_satang,
            NULL AS quantity_milli, duration_minutes, unit_label, total_satang, note, created_at
     FROM labor_hourly_work_basis_snapshots WHERE labor_job_id = ?
     ORDER BY created_at ASC, id ASC`,
    [jobId, jobId],
  );
  return rows.map((row) => ({
    id: row.id, jobId: row.labor_job_id, settlementRoute: row.settlement_route, basisKind: row.basis_kind,
    stage: row.stage, personId: row.person_id, rateSatang: row.rate_satang == null ? null : Number(row.rate_satang),
    quantityMilli: row.quantity_milli == null ? null : Number(row.quantity_milli), durationMinutes: row.duration_minutes == null ? null : Number(row.duration_minutes), unitLabel: row.unit_label,
    totalSatang: row.total_satang == null ? null : Number(row.total_satang), note: row.note, createdAt: row.created_at,
  }));
};

const selectedSettlementRoute = async (db: SqlExecutor, jobId: string): Promise<LaborSettlementRoute | null> => {
  const snapshots = await workBasisSnapshotsForJob(db, jobId);
  return snapshots[0]?.settlementRoute ?? null;
};

const assertBasisRoute = async (db: SqlExecutor, jobId: string, expected: LaborSettlementRoute): Promise<void> => {
  const route = await selectedSettlementRoute(db, jobId);
  if (route && route !== expected) throw new Error(`TAKAI work-basis settlement route is ${route}, not ${expected}`);
};

const hasCompletedContractBasis = async (db: SqlExecutor, jobId: string): Promise<boolean> => Boolean((await db.getAllAsync<{ id: string }>(
  "SELECT id FROM labor_work_basis_snapshots WHERE labor_job_id = ? AND basis_kind = 'contract' AND stage = 'completed' LIMIT 1",
  [jobId],
))[0]);

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

type PreparedNormalWork = {
  input: CreateNormalWorkInput;
  jobId: string;
  prepared: Array<{
    participant: CreateNormalWorkInput['participants'][number];
    person: PersonRow;
    index: number;
    dueSatang: number;
    payType: Exclude<LaborPayType, 'none' | 'contract'> | 'none';
    basis: { rateSatang: number; quantityMilli: number | null; durationMinutes: number | null; unitLabel: string } | null;
  }>;
};

const prepareNormalWork = async (db: SqlExecutor, input: CreateNormalWorkInput): Promise<PreparedNormalWork> => {
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
    const hasBasis = participant.rateSatang !== undefined || participant.quantityMilli !== undefined || participant.durationMinutes !== undefined || participant.unitLabel !== undefined;
    if (person.is_self) {
      if (participant.dueSatang != null && participant.dueSatang !== 0) throw new Error('TAKAI self participant cannot create a payable');
      if (hasBasis) throw new Error('TAKAI self participant cannot own an individual work-basis payable');
      return { participant, person, index, dueSatang: 0, payType: 'none' as const, basis: null };
    }
    if (person.role !== 'worker') throw new Error(`TAKAI payable participant must be an active worker: ${participant.personId}`);
    if (participant.dueSatang == null) throw new Error('TAKAI worker participant requires due satang');
    assertPositiveSatang(participant.dueSatang, 'worker due');
    const payType = participant.payType ?? 'daily';
    if (hasBasis) {
      if (participant.rateSatang === undefined) throw new Error('TAKAI individual work basis requires a rate');
      let dueSatang: number;
      let quantityMilli: number | null = null;
      let durationMinutes: number | null = null;
      let unitLabel = trimmed(participant.unitLabel);
      if (payType === 'daily') {
        if (participant.durationMinutes !== undefined || participant.quantityMilli === undefined || ![500, 1000].includes(participant.quantityMilli)) {
          throw new Error('TAKAI daily work supports full day or half day only; use hourly for other durations');
        }
        dueSatang = dueForRateAndQuantity(participant.rateSatang, participant.quantityMilli, 'daily work');
        quantityMilli = participant.quantityMilli;
        unitLabel ||= 'วัน';
      } else if (payType === 'hourly') {
        if (participant.quantityMilli !== undefined || participant.durationMinutes === undefined) throw new Error('TAKAI hourly work requires rate and duration minutes, without quantity');
        dueSatang = dueForHourlyRateAndDuration(participant.rateSatang, participant.durationMinutes, 'hourly work');
        durationMinutes = participant.durationMinutes;
        unitLabel ||= 'ชั่วโมง';
      } else if (payType === 'piece') {
        if (participant.durationMinutes !== undefined || participant.quantityMilli === undefined) throw new Error('TAKAI piece work requires rate and quantity, without duration minutes');
        dueSatang = dueForRateAndQuantity(participant.rateSatang, participant.quantityMilli, 'piece work');
        quantityMilli = participant.quantityMilli;
      } else {
        throw new Error('TAKAI individual work basis supports daily, hourly, or piece pay only');
      }
      if (dueSatang !== participant.dueSatang) throw new Error('TAKAI individual work due must equal rate times own quantity');
      return { participant, person, index, dueSatang: participant.dueSatang, payType, basis: { rateSatang: participant.rateSatang, quantityMilli, durationMinutes, unitLabel } };
    }
    return { participant, person, index, dueSatang: participant.dueSatang, payType, basis: null };
  }));
  return { input: { ...input, title }, jobId, prepared };
};

const persistNormalWork = async (db: SqlExecutor, work: PreparedNormalWork, now: string): Promise<{ jobId: string; payableIds: string[] }> => {
  const { input, jobId, prepared } = work;
  await db.runAsync(
    `INSERT INTO labor_jobs (id, title, work_date, plot_id, note, kind, status, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, 'normal', 'open', ?, ?)`,
    [jobId, input.title, input.workDate, trimmed(input.note), now, now],
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
    if (item.basis) {
      await appendWorkBasisSnapshot(db, {
        id: `${jobId}-basis-${item.index + 1}`,
        jobId,
        settlementRoute: 'individual',
        basisKind: item.payType === 'piece' ? 'piece' : item.payType === 'hourly' ? 'hourly' : 'daily',
        stage: 'recorded',
        personId: item.person.id,
        rateSatang: item.basis.rateSatang,
        quantityMilli: item.basis.quantityMilli,
        durationMinutes: item.basis.durationMinutes,
        unitLabel: item.basis.unitLabel,
        totalSatang: item.dueSatang,
        note: trimmed(item.participant.note),
        createdAt: now,
      });
    }
  }
  await appendTimeline(db, {
    entityType: 'labor_job', entityId: jobId, action: 'normal_work_created', occurredAt: now, reason: null,
    before: null,
    after: { id: jobId, title: input.title, workDate: input.workDate, plotId: null, kind: 'normal', participants: prepared.map((item) => ({ personId: item.person.id, dueSatang: item.dueSatang, payType: item.payType })) },
    personId: null, laborJobId: jobId,
  });
  return { jobId, payableIds };
};

export const createNormalWork = async (db: SqlExecutor, input: CreateNormalWorkInput, now = timestamp()): Promise<{ jobId: string; payableIds: string[] }> => {
  const prepared = await prepareNormalWork(db, input);
  return withTransaction(db, () => persistNormalWork(db, prepared, now));
};

type PreparedGroupPieceWork = {
  input: CreateGroupPieceWorkInput;
  jobId: string;
  settlementGroupId: string;
  memberPersonIds: string[];
  collectorPersonId: string | null;
  collectorLabel: string;
  originalDueSatang: number;
  unitLabel: string;
};

const prepareGroupPieceWork = async (db: SqlExecutor, input: CreateGroupPieceWorkInput): Promise<PreparedGroupPieceWork> => {
  const title = trimmed(input.title);
  const memberPersonIds = input.memberPersonIds.map((personId) => trimmed(personId));
  if (!title) throw new Error('TAKAI group piece work requires a title');
  assertDate(input.workDate, 'group piece work date');
  if (!memberPersonIds.length || memberPersonIds.some((personId) => !personId) || new Set(memberPersonIds).size !== memberPersonIds.length) {
    throw new Error('TAKAI group piece work requires distinct worker members');
  }
  const unitLabel = trimmed(input.unitLabel);
  if (!unitLabel) throw new Error('TAKAI group piece work requires a unit label');
  const originalDueSatang = dueForRateAndQuantity(input.rateSatang, input.quantityMilli, 'group piece work');
  const jobId = input.id ?? generatedId('group-piece-job');
  const settlementGroupId = input.settlementGroupId ?? `${jobId}-settlement-group`;
  const collectorPersonId = trimmed(input.collectorPersonId) || null;
  const collectorLabel = trimmed(input.collectorLabel);
  if (collectorPersonId) await activeWorker(db, collectorPersonId);
  for (const personId of memberPersonIds) await activeWorker(db, personId);
  return { input: { ...input, title }, jobId, settlementGroupId, memberPersonIds, collectorPersonId, collectorLabel, originalDueSatang, unitLabel };
};

const persistGroupPieceWork = async (db: SqlExecutor, work: PreparedGroupPieceWork, now: string): Promise<{ jobId: string; settlementGroupId: string }> => {
  const { input, jobId, settlementGroupId, memberPersonIds, collectorPersonId, collectorLabel, originalDueSatang, unitLabel } = work;
  await db.runAsync(
    `INSERT INTO labor_jobs (id, title, work_date, plot_id, note, kind, status, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, 'normal', 'open', ?, ?)`,
    [jobId, input.title, input.workDate, trimmed(input.note), now, now],
  );
  for (const [index, personId] of memberPersonIds.entries()) {
    await db.runAsync(
      `INSERT INTO labor_job_participants (id, labor_job_id, person_id, pay_type, sort_order, note)
       VALUES (?, ?, ?, 'piece', ?, '')`,
      [`${jobId}-participant-${index + 1}`, jobId, personId, index],
    );
  }
  await db.runAsync(
    `INSERT INTO labor_settlement_groups
     (id, labor_job_id, original_due_satang, status, collector_person_id, collector_label, created_at, updated_at)
     VALUES (?, ?, ?, 'open', ?, ?, ?, ?)`,
    [settlementGroupId, jobId, originalDueSatang, collectorPersonId, collectorLabel, now, now],
  );
  for (const [index] of memberPersonIds.entries()) {
    await db.runAsync(
      `INSERT INTO labor_settlement_group_members (id, settlement_group_id, participant_id, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [`${settlementGroupId}-member-${index + 1}`, settlementGroupId, `${jobId}-participant-${index + 1}`, index, now],
    );
  }
  await appendWorkBasisSnapshot(db, {
    id: `${jobId}-basis-1`, jobId, settlementRoute: 'group', basisKind: 'piece', stage: 'recorded', personId: null,
    rateSatang: input.rateSatang, quantityMilli: input.quantityMilli, durationMinutes: null, unitLabel, totalSatang: originalDueSatang, note: trimmed(input.note), createdAt: now,
  });
  const group = await settlementGroupSnapshot(db, settlementGroupId);
  await appendTimeline(db, {
    entityType: 'labor_job', entityId: jobId, action: 'settlement_group_created', occurredAt: now, reason: null,
    before: null, after: group, personId: null, laborJobId: jobId,
  });
  await appendTimeline(db, {
    entityType: 'labor_job', entityId: jobId, action: 'group_piece_work_recorded', occurredAt: now, reason: null, before: null,
    after: { title: input.title, workDate: input.workDate, settlementRoute: 'group', quantityMilli: input.quantityMilli, unitLabel, rateSatang: input.rateSatang, originalDueSatang, group },
    personId: null, laborJobId: jobId,
  });
  return { jobId, settlementGroupId };
};

export const createGroupPieceWork = async (db: SqlExecutor, input: CreateGroupPieceWorkInput, now = timestamp()): Promise<{ jobId: string; settlementGroupId: string }> => {
  const prepared = await prepareGroupPieceWork(db, input);
  return withTransaction(db, () => persistGroupPieceWork(db, prepared, now));
};

/**
 * Records a single notebook submission as several queryable jobs.  All rows
 * share one work date, but group work remains a single settlement due and is
 * never expanded into inferred member payables.
 */
export const recordLaborWorkItems = async (db: SqlExecutor, input: RecordLaborWorkItemsInput, now = timestamp()): Promise<RecordedLaborWorkItem[]> => {
  assertDate(input.workDate, 'work date');
  if (!input.items.length) throw new Error('TAKAI work record requires at least one work item');
  return withTransaction(db, async () => {
    const recorded: RecordedLaborWorkItem[] = [];
    for (const item of input.items) {
      if (item.settlementRoute === 'individual') {
        const { settlementRoute: _settlementRoute, ...normalInput } = item;
        const prepared = await prepareNormalWork(db, { ...normalInput, workDate: input.workDate });
        const result = await persistNormalWork(db, prepared, now);
        recorded.push({ settlementRoute: 'individual', ...result });
      } else {
        const { settlementRoute: _settlementRoute, ...groupInput } = item;
        const prepared = await prepareGroupPieceWork(db, { ...groupInput, workDate: input.workDate });
        const result = await persistGroupPieceWork(db, prepared, now);
        recorded.push({ settlementRoute: 'group', ...result });
      }
    }
    return recorded;
  });
};

/*
 * The lower-level commands above retain their single-job public contracts.
 * recordLaborWorkItems is the only transaction-level entry point for a
 * multi-row work-record submission.
 */
export const createLaborContract = async (db: SqlExecutor, input: CreateLaborContractInput, now = timestamp()): Promise<string> => {
  const title = trimmed(input.title);
  if (!title) throw new Error('TAKAI contract requires a title');
  assertDate(input.workDate, 'contract work date');
  if (input.startsOn) assertDate(input.startsOn, 'contract start date');
  if (input.deadlineOn) assertDate(input.deadlineOn, 'contract deadline date');
  const prepared = await assertContractParticipants(db, input.participants);
  const jobId = input.id ?? generatedId('labor-contract');
  await withTransaction(db, async () => {
    await db.runAsync(
      `INSERT INTO labor_jobs (id, title, work_date, plot_id, note, kind, status, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, 'contract', 'open', ?, ?)`,
      [jobId, title, input.workDate, trimmed(input.note), now, now],
    );
    await db.runAsync(
      `INSERT INTO labor_contract_details
       (labor_job_id, starts_on, deadline_on, completed_on, status, agreed_total_satang, final_total_satang)
       VALUES (?, ?, ?, NULL, 'awaiting_amount', NULL, NULL)`,
      [jobId, input.startsOn ?? null, input.deadlineOn ?? null],
    );
    for (const participant of prepared) {
      await db.runAsync(
        `INSERT INTO labor_job_participants (id, labor_job_id, person_id, pay_type, sort_order, note)
         VALUES (?, ?, ?, 'contract', ?, ?)`,
        [participant.input.participantId ?? `${jobId}-participant-${participant.index + 1}`, jobId, participant.person.id, participant.index, trimmed(participant.input.note)],
      );
    }
    if (input.settlementRoute) {
      await appendWorkBasisSnapshot(db, {
        id: `${jobId}-basis-started`,
        jobId,
        settlementRoute: input.settlementRoute,
        basisKind: 'contract',
        stage: 'started',
        personId: null,
        rateSatang: null,
        quantityMilli: null,
        durationMinutes: null,
        unitLabel: '',
        totalSatang: null,
        note: trimmed(input.note),
        createdAt: now,
      });
    }
    await appendTimeline(db, {
      entityType: 'labor_job', entityId: jobId, action: 'contract_created', occurredAt: now, reason: null, before: null,
      after: { id: jobId, title, workDate: input.workDate, plotId: null, startsOn: input.startsOn ?? null, deadlineOn: input.deadlineOn ?? null, participants: prepared.map((participant) => participant.person.id), settlementRoute: input.settlementRoute ?? null, totalSatang: null },
      personId: null, laborJobId: jobId,
    });
  });
  return jobId;
};

export const addLaborContractProgress = async (db: SqlExecutor, jobId: string, input: AddContractProgressInput, now = timestamp()): Promise<string> => {
  assertDate(input.progressDate, 'contract progress date');
  const note = trimmed(input.note);
  if (!note) throw new Error('TAKAI contract progress requires a note');
  if (input.quantityMilli !== undefined) {
    assertPositiveQuantityMilli(input.quantityMilli, 'contract progress quantity');
    if (!trimmed(input.unitLabel)) throw new Error('TAKAI contract progress quantity requires a unit label');
  }
  const id = input.id ?? generatedId('contract-progress');
  await withTransaction(db, async () => {
    await contractJob(db, jobId);
    await db.runAsync(
      `INSERT INTO labor_job_progress (id, labor_job_id, progress_date, note, plot_id, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
      [id, jobId, input.progressDate, note, now],
    );
    if (input.quantityMilli !== undefined) {
      const route = await selectedSettlementRoute(db, jobId);
      if (!route) throw new Error('TAKAI contract progress quantity requires an explicit settlement route');
      await appendWorkBasisSnapshot(db, {
        id: `${id}-basis`, jobId, settlementRoute: route, basisKind: 'contract', stage: 'progress', personId: null,
        rateSatang: null, quantityMilli: input.quantityMilli, durationMinutes: null, unitLabel: trimmed(input.unitLabel), totalSatang: null, note, createdAt: now,
      });
    }
    await appendTimeline(db, {
      entityType: 'labor_job', entityId: jobId, action: 'contract_progress_added', occurredAt: now, reason: null, before: null,
      after: { id, progressDate: input.progressDate, note, plotId: null }, personId: null, laborJobId: jobId,
    });
  });
  return id;
};

export const completeLaborContractWork = async (db: SqlExecutor, jobId: string, input: CompleteLaborContractWorkInput, now = timestamp()): Promise<string> => {
  assertDate(input.completedOn, 'contract completion date');
  assertPositiveSatang(input.finalTotalSatang, 'contract final total');
  const hasRate = input.rateSatang !== undefined || input.quantityMilli !== undefined;
  if (hasRate) {
    if (input.rateSatang === undefined || input.quantityMilli === undefined) throw new Error('TAKAI contract completion requires rate and quantity together');
    if (!trimmed(input.unitLabel)) throw new Error('TAKAI contract completion quantity requires a unit label');
    if (dueForRateAndQuantity(input.rateSatang, input.quantityMilli, 'contract completion') !== input.finalTotalSatang) {
      throw new Error('TAKAI contract final total must equal rate times aggregate quantity');
    }
  }
  const snapshotId = input.id ?? generatedId('contract-completed');
  await withTransaction(db, async () => {
    const contract = await contractJob(db, jobId);
    const route = await selectedSettlementRoute(db, jobId);
    if (!route) throw new Error('TAKAI contract completion requires an explicit settlement route');
    if (contract.final_total_satang != null || await hasCompletedContractBasis(db, jobId)) throw new Error('TAKAI contract final total is immutable once recorded');
    if (await hasContractPayment(db, jobId)) throw new Error('TAKAI contract final total cannot change after payment');
    await db.runAsync(
      `UPDATE labor_contract_details
       SET final_total_satang = ?, completed_on = ?, status = 'completed'
       WHERE labor_job_id = ?`,
      [input.finalTotalSatang, input.completedOn, jobId],
    );
    await appendWorkBasisSnapshot(db, {
      id: snapshotId, jobId, settlementRoute: route, basisKind: 'contract', stage: 'completed', personId: null,
      rateSatang: input.rateSatang ?? null, quantityMilli: input.quantityMilli ?? null, durationMinutes: null, unitLabel: trimmed(input.unitLabel),
      totalSatang: input.finalTotalSatang, note: trimmed(input.note), createdAt: now,
    });
    await db.runAsync('UPDATE labor_jobs SET updated_at = ? WHERE id = ?', [now, jobId]);
    await appendTimeline(db, {
      entityType: 'labor_job', entityId: jobId, action: 'contract_completed_with_basis', occurredAt: now, reason: null,
      before: { totalSatang: contract.final_total_satang, status: contract.status },
      after: { settlementRoute: route, totalSatang: input.finalTotalSatang, completedOn: input.completedOn, rateSatang: input.rateSatang ?? null, quantityMilli: input.quantityMilli ?? null, unitLabel: trimmed(input.unitLabel) },
      personId: null, laborJobId: jobId,
    });
  });
  return snapshotId;
};

export const reconcileLaborContractShares = async (db: SqlExecutor, jobId: string, input: ReconcileContractSharesInput, now = timestamp()): Promise<string[]> => {
  assertPositiveSatang(input.totalSatang, 'contract total');
  if (!input.shares.length) throw new Error('TAKAI contract requires explicit worker shares');
  const reason = trimmed(input.reason);
  const seen = new Set<string>();
  for (const share of input.shares) {
    if (!trimmed(share.personId) || seen.has(share.personId)) throw new Error('TAKAI contract shares must name distinct workers');
    seen.add(share.personId);
    assertPositiveSatang(share.amountSatang, 'contract share');
  }
  if (input.shares.reduce((sum, share) => sum + share.amountSatang, 0) !== input.totalSatang) throw new Error('TAKAI contract shares must equal the contract total exactly');
  return withTransaction(db, async () => {
    const contract = await contractJob(db, jobId);
    if (contract.status === 'cancelled') throw new Error(`TAKAI contract is unavailable: ${jobId}`);
    await assertBasisRoute(db, jobId, 'individual');
    if ((await settlementGroupRows(db, jobId)).length) throw new Error('TAKAI contract cannot mix individual shares with a settlement group');
    if (contract.final_total_satang != null && Number(contract.final_total_satang) !== input.totalSatang) throw new Error('TAKAI contract shares must equal the immutable completed total');
    const existingIndividualPayable = (await db.getAllAsync<{ id: string }>('SELECT id FROM labor_payables WHERE labor_job_id = ? LIMIT 1', [jobId]))[0];
    if (existingIndividualPayable && !reason) throw new Error('TAKAI contract share update requires a reason');
    if (await hasContractPayment(db, jobId)) throw new Error('TAKAI contract shares cannot change after payment');
    const participantRows = await db.getAllAsync<{ id: string; person_id: string }>(
      "SELECT id, person_id FROM labor_job_participants WHERE labor_job_id = ? AND pay_type = 'contract' ORDER BY sort_order ASC",
      [jobId],
    );
    if (participantRows.length !== input.shares.length || participantRows.some((participant) => !seen.has(participant.person_id))) {
      throw new Error('TAKAI contract shares must cover every contract participant exactly once');
    }
    for (const share of input.shares) await activeWorker(db, share.personId);
    const before = { totalSatang: contract.final_total_satang ?? contract.agreed_total_satang, status: contract.status };
    await db.runAsync('DELETE FROM labor_payables WHERE labor_job_id = ?', [jobId]);
    const participantByPerson = new Map(participantRows.map((participant) => [participant.person_id, participant]));
    const payableIds: string[] = [];
    for (const [index, share] of input.shares.entries()) {
      const payableId = share.payableId ?? `${jobId}-payable-${index + 1}`;
      await db.runAsync(
        `INSERT INTO labor_payables (id, labor_job_id, participant_id, person_id, due_satang, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?)`,
        [payableId, jobId, participantByPerson.get(share.personId)!.id, share.personId, share.amountSatang, now],
      );
      payableIds.push(payableId);
    }
    await db.runAsync(
      `UPDATE labor_contract_details
       SET agreed_total_satang = ?, final_total_satang = ?, status = ?
       WHERE labor_job_id = ?`,
      [input.totalSatang, input.totalSatang, contract.status === 'completed' ? 'completed' : 'in_progress', jobId],
    );
    await db.runAsync('UPDATE labor_jobs SET updated_at = ? WHERE id = ?', [now, jobId]);
    await appendTimeline(db, {
      entityType: 'labor_job', entityId: jobId, action: 'contract_shares_reconciled', occurredAt: now,
      reason: reason || null, before,
      after: { totalSatang: input.totalSatang, status: contract.status === 'completed' ? 'completed' : 'in_progress', shares: input.shares.map((share) => ({ personId: share.personId, amountSatang: share.amountSatang })) },
      personId: null, laborJobId: jobId,
    });
    return payableIds;
  });
};

const legacySourceRows = async (db: SqlExecutor, legacyLaborEntryIds: string[]): Promise<LegacySourceRow[]> => {
  if (!legacyLaborEntryIds.length) throw new Error('TAKAI legacy import requires at least one unpaid source');
  if (new Set(legacyLaborEntryIds).size !== legacyLaborEntryIds.length || legacyLaborEntryIds.some((id) => !trimmed(id))) throw new Error('TAKAI legacy import sources must be distinct');
  const placeholders = legacyLaborEntryIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<LegacySourceRow>(
    `SELECT entry.id, entry.person_id, entry.work_date, entry.amount_due, entry.amount_paid, batch.imported_at
     FROM labor_entries AS entry
     JOIN people ON people.id = entry.person_id
     LEFT JOIN legacy_labor_import_links AS link ON link.legacy_labor_entry_id = entry.id
     LEFT JOIN legacy_labor_import_batches AS batch ON batch.id = link.import_batch_id
     WHERE entry.id IN (${placeholders}) AND entry.status = 'unpaid' AND entry.amount_due > entry.amount_paid`,
    legacyLaborEntryIds,
  );
  if (rows.length !== legacyLaborEntryIds.length) throw new Error('TAKAI selected legacy unpaid source is unavailable');
  if (rows.some((row) => row.imported_at != null)) throw new Error('TAKAI legacy source was already imported');
  return legacyLaborEntryIds.map((id) => rows.find((row) => row.id === id)!);
};

export const importLegacyLaborEntries = async (db: SqlExecutor, input: ImportLegacyLaborEntriesInput, now = timestamp()): Promise<{ batchId: string; payableIds: string[] }> => {
  const sources = await legacySourceRows(db, input.legacyLaborEntryIds);
  const prepared = await Promise.all(sources.map(async (source) => {
    await activeWorker(db, source.person_id);
    const remainingSatang = bahtToSatang(Number(source.amount_due) - Number(source.amount_paid), 'legacy remaining balance');
    assertPositiveSatang(remainingSatang, 'legacy remaining balance');
    return { ...source, remainingSatang };
  }));
  const batchId = input.id ?? generatedId('legacy-import');
  return withTransaction(db, async () => {
    await db.runAsync(
      'INSERT INTO legacy_labor_import_batches (id, imported_at, note, created_by_person_id) VALUES (?, ?, ?, NULL)',
      [batchId, now, trimmed(input.note)],
    );
    const payableIds: string[] = [];
    for (const [index, source] of prepared.entries()) {
      const jobId = `${batchId}-job-${index + 1}`;
      const participantId = `${jobId}-participant-1`;
      const payableId = `${jobId}-payable-1`;
      await db.runAsync(
        `INSERT INTO labor_jobs (id, title, work_date, plot_id, note, kind, status, created_at, updated_at)
         VALUES (?, 'ยอดยกมา', ?, NULL, ?, 'legacy_import', 'open', ?, ?)`,
        [jobId, source.work_date, trimmed(input.note), now, now],
      );
      await db.runAsync(
        `INSERT INTO labor_job_participants (id, labor_job_id, person_id, pay_type, sort_order, note)
         VALUES (?, ?, ?, 'daily', 0, '')`,
        [participantId, jobId, source.person_id],
      );
      await db.runAsync(
        `INSERT INTO labor_payables (id, labor_job_id, participant_id, person_id, due_satang, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?)`,
        [payableId, jobId, participantId, source.person_id, source.remainingSatang, now],
      );
      await db.runAsync(
        `INSERT INTO legacy_labor_import_links
         (id, import_batch_id, legacy_labor_entry_id, labor_payable_id, source_work_date, source_due_satang, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [`${batchId}-link-${index + 1}`, batchId, source.id, payableId, source.work_date, source.remainingSatang, now],
      );
      await appendTimeline(db, {
        entityType: 'labor_job', entityId: jobId, action: 'legacy_carry_forward_imported', occurredAt: now, reason: null, before: null,
        after: { sourceLaborEntryId: source.id, workDate: source.work_date, remainingSatang: source.remainingSatang, label: 'ยอดยกมา' },
        personId: source.person_id, laborJobId: jobId,
      });
      payableIds.push(payableId);
    }
    return { batchId, payableIds };
  });
};

export const createManualOpeningBalance = async (db: SqlExecutor, input: CreateManualOpeningBalanceInput, now = timestamp()): Promise<string> => {
  assertDate(input.workDate, 'opening balance date');
  assertPositiveSatang(input.dueSatang, 'opening balance');
  const worker = await activeWorker(db, input.personId);
  const jobId = input.id ?? generatedId('manual-opening');
  const participantId = input.participantId ?? `${jobId}-participant-1`;
  const payableId = input.payableId ?? `${jobId}-payable-1`;
  await withTransaction(db, async () => {
    await db.runAsync(
      `INSERT INTO labor_jobs (id, title, work_date, plot_id, note, kind, status, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, 'legacy_import', 'open', ?, ?)`,
      [jobId, trimmed(input.title) || 'ยอดยกมา', input.workDate, trimmed(input.note), now, now],
    );
    await db.runAsync(
      `INSERT INTO labor_job_participants (id, labor_job_id, person_id, pay_type, sort_order, note)
       VALUES (?, ?, ?, 'daily', 0, '')`,
      [participantId, jobId, worker.id],
    );
    await db.runAsync(
      `INSERT INTO labor_payables (id, labor_job_id, participant_id, person_id, due_satang, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?)`,
      [payableId, jobId, participantId, worker.id, input.dueSatang, now],
    );
    await appendTimeline(db, {
      entityType: 'labor_job', entityId: jobId, action: 'manual_opening_balance_created', occurredAt: now, reason: null, before: null,
      after: { personId: worker.id, workDate: input.workDate, dueSatang: input.dueSatang, label: trimmed(input.title) || 'ยอดยกมา' },
      personId: worker.id, laborJobId: jobId,
    });
  });
  return payableId;
};

const assertNonNegativeSatang = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`TAKAI ${label} must be a non-negative INTEGER satang amount`);
};

const paymentSessionSnapshot = async (db: SqlExecutor, paymentSessionId: string): Promise<LaborPaymentSession> => {
  const session = (await db.getAllAsync<PaymentSessionRow>(
    `SELECT id, payment_date, method, note, cash_paid_satang, current_revision, status, created_at
     FROM labor_payment_sessions WHERE id = ? AND status IN ('posted', 'revised') LIMIT 1`,
    [paymentSessionId],
  ))[0];
  if (!session) throw new Error(`TAKAI payment session is unavailable: ${paymentSessionId}`);
  const settlements = await db.getAllAsync<PaymentSessionSettlementRow>(
    `SELECT id, payment_session_id, recipient_type, person_id, settlement_group_id, wage_satang, bonus_satang,
            advance_recovered_satang, cash_paid_satang
     FROM labor_payment_session_settlements WHERE payment_session_id = ? ORDER BY id ASC`,
    [paymentSessionId],
  );
  const settlementIds = settlements.map((settlement) => settlement.id);
  const [allocations, recoveries] = settlementIds.length ? await Promise.all([
    db.getAllAsync<PaymentSessionWageAllocationRow>(
      `SELECT id, settlement_id, labor_payable_id, amount_satang
       FROM labor_payment_session_wage_allocations
       WHERE settlement_id IN (${settlementIds.map(() => '?').join(', ')}) ORDER BY id ASC`, settlementIds,
    ),
    db.getAllAsync<PaymentSessionAdvanceRecoveryRow>(
      `SELECT id, settlement_id, labor_worker_advance_id, labor_payable_id, amount_satang
       FROM labor_payment_session_advance_recoveries
       WHERE settlement_id IN (${settlementIds.map(() => '?').join(', ')}) ORDER BY id ASC`, settlementIds,
    ),
  ]) : [[], []] as [PaymentSessionWageAllocationRow[], PaymentSessionAdvanceRecoveryRow[]];
  return {
    id: session.id, paymentDate: session.payment_date, method: session.method, note: session.note,
    cashPaidSatang: Number(session.cash_paid_satang), currentRevision: Number(session.current_revision), status: session.status, createdAt: session.created_at,
    settlements: settlements.map((settlement): LaborPaymentSessionSettlement => ({
      id: settlement.id, recipientType: settlement.recipient_type, personId: settlement.person_id,
      settlementGroupId: settlement.settlement_group_id, wageSatang: Number(settlement.wage_satang),
      bonusSatang: Number(settlement.bonus_satang), advanceRecoveredSatang: Number(settlement.advance_recovered_satang),
      cashPaidSatang: Number(settlement.cash_paid_satang),
      wageAllocations: allocations.filter((allocation) => allocation.settlement_id === settlement.id).map((allocation) => ({
        id: allocation.id, payableId: allocation.labor_payable_id, amountSatang: Number(allocation.amount_satang),
      })),
      advanceRecoveries: recoveries.filter((recovery) => recovery.settlement_id === settlement.id).map((recovery) => ({
        id: recovery.id, advanceId: recovery.labor_worker_advance_id, payableId: recovery.labor_payable_id,
        amountSatang: Number(recovery.amount_satang),
      })),
    })),
  };
};

type PreparedPaymentSessionSettlement =
  | {
    recipientType: 'person'; id: string; personId: string; wageRows: Array<PayableRow & { allocation: PaymentAllocationInput }>;
    bonusSatang: number; recoveries: PaymentSessionAdvanceRecoveryInput[]; wageSatang: number; recoverySatang: number; cashPaidSatang: number;
  }
  | {
    recipientType: 'group'; id: string; settlementGroupId: string; group: LaborSettlementGroup;
    bonusSatang: number; wageSatang: number; recoverySatang: 0; cashPaidSatang: number;
  };

const preparePaymentSession = async (db: SqlExecutor, input: Omit<PostLaborPaymentSessionInput, 'id'>, sessionId: string): Promise<PreparedPaymentSessionSettlement[]> => {
  assertDate(input.paymentDate, 'payment session date');
  if (!input.settlements.length) throw new Error('TAKAI payment session requires at least one recipient settlement');
  const recipients = new Set<string>();
  const prepared: PreparedPaymentSessionSettlement[] = [];
  for (const [index, settlement] of input.settlements.entries()) {
    const settlementId = settlement.id ?? `${sessionId}-settlement-${index + 1}`;
    const recipientKey = settlement.recipientType === 'person' ? `person:${trimmed(settlement.personId)}` : `group:${trimmed(settlement.settlementGroupId)}`;
    if (!recipientKey || recipientKey.endsWith(':') || recipients.has(recipientKey)) throw new Error('TAKAI payment session recipients must be distinct');
    recipients.add(recipientKey);
    const bonusSatang = settlement.bonusSatang ?? 0;
    assertNonNegativeSatang(bonusSatang, 'payment session bonus');
    if (settlement.recipientType === 'group') {
      if ('advanceRecoveries' in settlement && Array.isArray((settlement as { advanceRecoveries?: unknown }).advanceRecoveries) && (settlement as { advanceRecoveries: unknown[] }).advanceRecoveries.length) {
        throw new Error('TAKAI group payment session cannot recover a person advance');
      }
      assertPositiveSatang(settlement.wageSatang, 'group payment session wage');
      const group = await settlementGroupSnapshot(db, settlement.settlementGroupId);
      if (settlement.wageSatang > group.remainingSatang) throw new Error('TAKAI group payment session wage cannot exceed remaining balance');
      const cashPaidSatang = settlement.wageSatang + bonusSatang;
      if (!Number.isSafeInteger(cashPaidSatang)) throw new Error('TAKAI payment session cash exceeds safe satang range');
      prepared.push({ recipientType: 'group', id: settlementId, settlementGroupId: group.id, group, bonusSatang, wageSatang: settlement.wageSatang, recoverySatang: 0, cashPaidSatang });
      continue;
    }
    const worker = await activeWorker(db, settlement.personId);
    const wageRows = await payableRows(db, settlement.wageAllocations);
    await assertContractPayablesReadyForSettlement(db, wageRows);
    for (const row of wageRows) {
      if (row.person_id !== worker.id) throw new Error('TAKAI payment session person settlement must match every wage payable');
      const remainingSatang = Number(row.due_satang) - Number(row.paid_satang) - Number(row.recovered_satang);
      if (row.allocation.amountSatang > remainingSatang) throw new Error('TAKAI payment session wage allocation cannot exceed payable remaining balance');
    }
    const byPayable = new Map(wageRows.map((row) => [row.id, row.allocation.amountSatang]));
    const recoveredByPayable = new Map<string, number>();
    const recoveredByAdvance = new Map<string, number>();
    const recoveryKeys = new Set<string>();
    const recoveries = settlement.advanceRecoveries ?? [];
    for (const recovery of recoveries) {
      assertPositiveSatang(recovery.amountSatang, 'payment session advance recovery');
      const key = `${trimmed(recovery.advanceId)}|${trimmed(recovery.payableId)}`;
      if (!trimmed(recovery.advanceId) || !trimmed(recovery.payableId) || recoveryKeys.has(key)) throw new Error('TAKAI payment session advance recoveries must be distinct');
      recoveryKeys.add(key);
      const allocatedWageSatang = byPayable.get(recovery.payableId);
      if (allocatedWageSatang === undefined) throw new Error('TAKAI payment session advance recovery must use a selected wage payable');
      const recoveredOnPayable = (recoveredByPayable.get(recovery.payableId) ?? 0) + recovery.amountSatang;
      if (recoveredOnPayable > allocatedWageSatang) throw new Error('TAKAI payment session advance recovery cannot exceed selected wage allocation');
      recoveredByPayable.set(recovery.payableId, recoveredOnPayable);
      const advance = await advanceSnapshot(db, recovery.advanceId);
      if (advance.personId !== worker.id) throw new Error('TAKAI payment session advance recovery must belong to the same worker');
      const recoveredOnAdvance = (recoveredByAdvance.get(advance.id) ?? 0) + recovery.amountSatang;
      if (recoveredOnAdvance > advance.remainingSatang) throw new Error('TAKAI payment session advance recovery cannot exceed advance remaining balance');
      recoveredByAdvance.set(advance.id, recoveredOnAdvance);
    }
    const wageSatang = wageRows.reduce((sum, row) => sum + row.allocation.amountSatang, 0);
    const recoverySatang = recoveries.reduce((sum, recovery) => sum + recovery.amountSatang, 0);
    const cashPaidSatang = wageSatang + bonusSatang - recoverySatang;
    if (!Number.isSafeInteger(cashPaidSatang) || cashPaidSatang < 0) throw new Error('TAKAI payment session cash must reconcile to a non-negative safe satang amount');
    prepared.push({ recipientType: 'person', id: settlementId, personId: worker.id, wageRows, bonusSatang, recoveries, wageSatang, recoverySatang, cashPaidSatang });
  }
  return prepared;
};

const persistPaymentSession = async (
  db: SqlExecutor,
  sessionId: string,
  input: Omit<PostLaborPaymentSessionInput, 'id'>,
  settlements: PreparedPaymentSessionSettlement[],
  now: string,
  revision: number,
  status: 'posted' | 'revised',
): Promise<void> => {
  const cashPaidSatang = settlements.reduce((sum, settlement) => sum + settlement.cashPaidSatang, 0);
  if (!Number.isSafeInteger(cashPaidSatang)) throw new Error('TAKAI payment session total cash exceeds safe satang range');
  if (revision === 1) {
    await db.runAsync(
      `INSERT INTO labor_payment_sessions
       (id, payment_date, method, note, cash_paid_satang, current_revision, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, input.paymentDate, trimmed(input.method), trimmed(input.note), cashPaidSatang, revision, status, now, now],
    );
  } else {
    await db.runAsync(
      `UPDATE labor_payment_sessions
       SET payment_date = ?, method = ?, note = ?, cash_paid_satang = ?, current_revision = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [input.paymentDate, trimmed(input.method), trimmed(input.note), cashPaidSatang, revision, status, now, sessionId],
    );
  }
  for (const settlement of settlements) {
    await db.runAsync(
      `INSERT INTO labor_payment_session_settlements
       (id, payment_session_id, recipient_type, person_id, settlement_group_id, wage_satang, bonus_satang, advance_recovered_satang, cash_paid_satang)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [settlement.id, sessionId, settlement.recipientType, settlement.recipientType === 'person' ? settlement.personId : null,
        settlement.recipientType === 'group' ? settlement.settlementGroupId : null, settlement.wageSatang, settlement.bonusSatang,
        settlement.recoverySatang, settlement.cashPaidSatang],
    );
    if (settlement.recipientType === 'person') {
      for (const [index, row] of settlement.wageRows.entries()) {
        await db.runAsync(
          `INSERT INTO labor_payment_session_wage_allocations (id, settlement_id, labor_payable_id, amount_satang)
           VALUES (?, ?, ?, ?)`,
          [row.allocation.id ?? `${settlement.id}-wage-${index + 1}`, settlement.id, row.id, row.allocation.amountSatang],
        );
      }
      for (const [index, recovery] of settlement.recoveries.entries()) {
        await db.runAsync(
          `INSERT INTO labor_payment_session_advance_recoveries
           (id, settlement_id, labor_worker_advance_id, labor_payable_id, amount_satang)
           VALUES (?, ?, ?, ?, ?)`,
          [recovery.id ?? `${settlement.id}-recovery-${index + 1}`, settlement.id, recovery.advanceId, recovery.payableId, recovery.amountSatang],
        );
      }
    }
  }
  for (const settlement of settlements) {
    if (settlement.recipientType !== 'group') continue;
    const after = await settlementGroupSnapshot(db, settlement.settlementGroupId);
    await db.runAsync('UPDATE labor_settlement_groups SET status = ?, updated_at = ? WHERE id = ?', [after.remainingSatang === 0 ? 'settled' : 'open', now, settlement.settlementGroupId]);
  }
};

const appendPaymentSessionTimeline = async (
  db: SqlExecutor, session: LaborPaymentSession, action: 'payment_session_posted' | 'payment_session_corrected', now: string, reason: string | null, before: LaborPaymentSession | null,
): Promise<void> => {
  await appendTimeline(db, { entityType: 'labor_payment', entityId: session.id, action, occurredAt: now, reason, before, after: session, personId: null, laborJobId: null });
  for (const settlement of session.settlements) {
    if (settlement.recipientType === 'person' && settlement.personId) {
      await appendTimeline(db, {
        entityType: 'person', entityId: settlement.personId, action, occurredAt: now, reason,
        before: null, after: { paymentSessionId: session.id, settlement }, personId: settlement.personId, laborJobId: null,
      });
    }
    if (settlement.recipientType === 'group' && settlement.settlementGroupId) {
      const group = await settlementGroupSnapshot(db, settlement.settlementGroupId);
      await appendTimeline(db, {
        entityType: 'labor_job', entityId: group.jobId, action, occurredAt: now, reason,
        before: null, after: { paymentSessionId: session.id, settlement, group }, personId: null, laborJobId: group.jobId,
      });
    }
  }
};

/** One cash event may settle several people and/or group lump sums; callers may prefill by work or by person. */
export const postLaborPaymentSession = async (db: SqlExecutor, input: PostLaborPaymentSessionInput, now = timestamp()): Promise<string> => {
  const sessionId = input.id ?? generatedId('payment-session');
  return withTransaction(db, async () => {
    const settlements = await preparePaymentSession(db, input, sessionId);
    await persistPaymentSession(db, sessionId, input, settlements, now, 1, 'posted');
    const session = await paymentSessionSnapshot(db, sessionId);
    await appendPaymentSessionTimeline(db, session, 'payment_session_posted', now, null, null);
    return sessionId;
  });
};

/** Corrections retain the immutable timeline and require a human reason; historic rows are never rewritten. */
export const correctLaborPaymentSession = async (db: SqlExecutor, sessionId: string, input: CorrectLaborPaymentSessionInput, now = timestamp()): Promise<void> => {
  const reason = trimmed(input.reason);
  if (!reason) throw new Error('TAKAI payment session correction requires a reason');
  return withTransaction(db, async () => {
    const before = await paymentSessionSnapshot(db, sessionId);
    await db.runAsync("UPDATE labor_payment_sessions SET status = 'cancelled', updated_at = ? WHERE id = ?", [now, sessionId]);
    await db.runAsync('DELETE FROM labor_payment_session_settlements WHERE payment_session_id = ?', [sessionId]);
    for (const groupId of before.settlements.filter((settlement) => settlement.recipientType === 'group').map((settlement) => settlement.settlementGroupId).filter((groupId): groupId is string => Boolean(groupId))) {
      const group = await settlementGroupSnapshot(db, groupId);
      await db.runAsync('UPDATE labor_settlement_groups SET status = ?, updated_at = ? WHERE id = ?', [group.remainingSatang === 0 ? 'settled' : 'open', now, groupId]);
    }
    const settlements = await preparePaymentSession(db, input, sessionId);
    await persistPaymentSession(db, sessionId, input, settlements, now, before.currentRevision + 1, 'revised');
    const after = await paymentSessionSnapshot(db, sessionId);
    await appendPaymentSessionTimeline(db, after, 'payment_session_corrected', now, reason, before);
  });
};

export const postLaborPayment = async (db: SqlExecutor, input: PostLaborPaymentInput, now = timestamp()): Promise<string> => {
  assertDate(input.paymentDate, 'payment date');
  await activeWorker(db, input.personId);
  const paymentId = input.id ?? generatedId('labor-payment');
  return withTransaction(db, async () => {
    const rows = await payableRows(db, input.allocations);
    await assertContractPayablesReadyForSettlement(db, rows);
    for (const row of rows) {
      if (row.person_id !== input.personId) throw new Error('TAKAI payment payee must match every payable');
      if (row.allocation.amountSatang > Number(row.due_satang) - Number(row.paid_satang) - Number(row.recovered_satang)) throw new Error('TAKAI payment allocation cannot exceed payable remaining balance');
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
    await assertContractPayablesReadyForSettlement(db, rows);
    for (const row of rows) {
      if (row.person_id !== before.payment.personId) throw new Error('TAKAI payment payee must match every payable');
      const previousAllocation = before.allocations.find((allocation) => allocation.payable_id === row.id)?.amount_satang ?? 0;
      const alreadyPaidOutsideThisPayment = Number(row.paid_satang) - Number(previousAllocation);
      if (row.allocation.amountSatang > Number(row.due_satang) - Number(row.recovered_satang) - alreadyPaidOutsideThisPayment) throw new Error('TAKAI payment allocation cannot exceed payable remaining balance');
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

export const createLaborWorkerAdvance = async (db: SqlExecutor, input: CreateLaborWorkerAdvanceInput, now = timestamp()): Promise<string> => {
  assertDate(input.advanceDate, 'advance date');
  assertPositiveSatang(input.amountSatang, 'worker advance');
  const worker = await activeWorker(db, input.personId);
  const advanceId = input.id ?? generatedId('worker-advance');
  await withTransaction(db, async () => {
    await db.runAsync(
      `INSERT INTO labor_worker_advances
       (id, person_id, advance_date, amount_satang, method, note, current_revision, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 'posted', ?, ?)`,
      [advanceId, worker.id, input.advanceDate, input.amountSatang, trimmed(input.method), trimmed(input.note), now, now],
    );
    const after = await advanceSnapshot(db, advanceId);
    await appendTimeline(db, {
      entityType: 'person', entityId: worker.id, action: 'worker_advance_issued', occurredAt: now, reason: null,
      before: null, after, personId: worker.id, laborJobId: null,
    });
  });
  return advanceId;
};

export const editLaborWorkerAdvance = async (db: SqlExecutor, advanceId: string, input: EditLaborWorkerAdvanceInput, now = timestamp()): Promise<void> => {
  const reason = trimmed(input.reason);
  if (!reason) throw new Error('TAKAI worker advance edit requires a reason');
  assertDate(input.advanceDate, 'advance date');
  assertPositiveSatang(input.amountSatang, 'worker advance');
  await withTransaction(db, async () => {
    const before = await advanceSnapshot(db, advanceId);
    await activeWorker(db, before.personId);
    if (input.amountSatang < before.recoveredSatang) throw new Error('TAKAI worker advance cannot be corrected below recovered amount');
    await db.runAsync(
      `UPDATE labor_worker_advances
       SET advance_date = ?, amount_satang = ?, method = ?, note = ?, current_revision = current_revision + 1,
           status = 'revised', updated_at = ?
       WHERE id = ? AND status IN ('posted', 'revised')`,
      [input.advanceDate, input.amountSatang, trimmed(input.method), trimmed(input.note), now, advanceId],
    );
    const after = await advanceSnapshot(db, advanceId);
    await appendTimeline(db, {
      entityType: 'person', entityId: before.personId, action: 'worker_advance_corrected', occurredAt: now, reason,
      before, after, personId: before.personId, laborJobId: null,
    });
  });
};

export const applyLaborAdvanceDeduction = async (db: SqlExecutor, input: ApplyLaborAdvanceDeductionInput, now = timestamp()): Promise<string> => {
  assertDate(input.recoveryDate, 'advance recovery date');
  assertPositiveSatang(input.amountSatang, 'advance recovery');
  const deductionId = input.id ?? generatedId('advance-deduction');
  return withTransaction(db, async () => {
    const advance = await advanceSnapshot(db, input.advanceId);
    const row = (await payableRows(db, [{ payableId: input.payableId, amountSatang: input.amountSatang }]))[0]!;
    if (row.person_id !== advance.personId) throw new Error('TAKAI advance recovery must use an individual payable for the same worker');
    const payableRemainingSatang = Number(row.due_satang) - Number(row.paid_satang) - Number(row.recovered_satang);
    if (input.amountSatang > payableRemainingSatang) throw new Error('TAKAI advance recovery cannot exceed payable remaining balance');
    if (input.amountSatang > advance.remainingSatang) throw new Error('TAKAI advance recovery cannot exceed advance remaining balance');
    await db.runAsync(
      `INSERT INTO labor_advance_deductions
       (id, labor_worker_advance_id, labor_payable_id, person_id, recovery_date, amount_satang, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [deductionId, advance.id, row.id, advance.personId, input.recoveryDate, input.amountSatang, trimmed(input.note), now],
    );
    const afterAdvance = await advanceSnapshot(db, advance.id);
    const deduction = (await listLaborAdvanceDeductions(db, advance.personId)).find((item) => item.id === deductionId)!;
    await appendTimeline(db, {
      entityType: 'person', entityId: advance.personId, action: 'worker_advance_recovered_from_wage', occurredAt: now,
      reason: null, before: { advance, payableRemainingSatang },
      after: { advance: afterAdvance, deduction, payableId: row.id, cashPaidSatang: Number(row.paid_satang), wageRemainingSatang: payableRemainingSatang - input.amountSatang },
      personId: advance.personId, laborJobId: row.labor_job_id,
    });
    return deductionId;
  });
};

export const createLaborSettlementGroup = async (db: SqlExecutor, input: CreateLaborSettlementGroupInput, now = timestamp()): Promise<string> => {
  assertPositiveSatang(input.originalDueSatang, 'settlement group due');
  const memberPersonIds = input.memberPersonIds.map((personId) => trimmed(personId));
  if (!memberPersonIds.length || memberPersonIds.some((personId) => !personId) || new Set(memberPersonIds).size !== memberPersonIds.length) {
    throw new Error('TAKAI settlement group requires distinct worker members');
  }
  const collectorPersonId = trimmed(input.collectorPersonId) || null;
  const collectorLabel = trimmed(input.collectorLabel);
  const groupId = input.id ?? generatedId('settlement-group');
  await withTransaction(db, async () => {
    await assertJobAllowsSettlementGroup(db, input.laborJobId);
    await assertBasisRoute(db, input.laborJobId, 'group');
    const job = (await db.getAllAsync<{ kind: string }>('SELECT kind FROM labor_jobs WHERE id = ? LIMIT 1', [input.laborJobId]))[0];
    if (job?.kind === 'contract' && (await selectedSettlementRoute(db, input.laborJobId)) === 'group' && !(await hasCompletedContractBasis(db, input.laborJobId))) {
      throw new Error('TAKAI group contract settlement requires completed final output first');
    }
    if (job?.kind === 'contract' && (await selectedSettlementRoute(db, input.laborJobId)) === 'group') {
      const completed = (await workBasisSnapshotsForJob(db, input.laborJobId)).find((snapshot) => snapshot.basisKind === 'contract' && snapshot.stage === 'completed');
      if (completed?.totalSatang !== input.originalDueSatang) throw new Error('TAKAI group contract due must equal the immutable completed total');
    }
    if (collectorPersonId) await activeWorker(db, collectorPersonId);
    const placeholders = memberPersonIds.map(() => '?').join(', ');
    const participants = await db.getAllAsync<{ id: string; person_id: string; sort_order: number; role: string; is_self: number }>(
      `SELECT participant.id, participant.person_id, participant.sort_order, person.role, person.is_self
       FROM labor_job_participants AS participant
       JOIN people AS person ON person.id = participant.person_id
       WHERE participant.labor_job_id = ? AND participant.person_id IN (${placeholders})
       ORDER BY participant.sort_order ASC, participant.id ASC`,
      [input.laborJobId, ...memberPersonIds],
    );
    if (participants.length !== memberPersonIds.length || participants.some((participant) => participant.role !== 'worker' || participant.is_self)) {
      throw new Error('TAKAI settlement group members must be existing worker participants of this job');
    }
    await db.runAsync(
      `INSERT INTO labor_settlement_groups
       (id, labor_job_id, original_due_satang, status, collector_person_id, collector_label, created_at, updated_at)
       VALUES (?, ?, ?, 'open', ?, ?, ?, ?)`,
      [groupId, input.laborJobId, input.originalDueSatang, collectorPersonId, collectorLabel, now, now],
    );
    const participantByPerson = new Map(participants.map((participant) => [participant.person_id, participant]));
    for (const [index, personId] of memberPersonIds.entries()) {
      const participant = participantByPerson.get(personId)!;
      await db.runAsync(
        `INSERT INTO labor_settlement_group_members (id, settlement_group_id, participant_id, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [`${groupId}-member-${index + 1}`, groupId, participant.id, index, now],
      );
    }
    const after = await settlementGroupSnapshot(db, groupId);
    await appendTimeline(db, {
      entityType: 'labor_job', entityId: input.laborJobId, action: 'settlement_group_created', occurredAt: now, reason: null,
      before: null, after, personId: null, laborJobId: input.laborJobId,
    });
  });
  return groupId;
};

export const postLaborSettlementGroupReceipt = async (db: SqlExecutor, input: PostLaborSettlementGroupReceiptInput, now = timestamp()): Promise<string> => {
  assertDate(input.receiptDate, 'settlement group receipt date');
  assertPositiveSatang(input.amountSatang, 'settlement group receipt');
  const receiptId = input.id ?? generatedId('settlement-group-receipt');
  await withTransaction(db, async () => {
    const before = await settlementGroupSnapshot(db, input.settlementGroupId);
    if (before.status !== 'open') throw new Error('TAKAI settlement group is not open for a receipt');
    if (input.amountSatang > before.remainingSatang) throw new Error('TAKAI settlement group receipt cannot exceed remaining balance');
    await db.runAsync(
      `INSERT INTO labor_settlement_group_receipts
       (id, settlement_group_id, receipt_date, amount_satang, method, note, current_revision, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 'posted', ?, ?)`,
      [receiptId, input.settlementGroupId, input.receiptDate, input.amountSatang, trimmed(input.method), trimmed(input.note), now, now],
    );
    const after = await settlementGroupSnapshot(db, input.settlementGroupId);
    await db.runAsync(
      'UPDATE labor_settlement_groups SET status = ?, updated_at = ? WHERE id = ?',
      [after.remainingSatang === 0 ? 'settled' : 'open', now, input.settlementGroupId],
    );
    const finalAfter = await settlementGroupSnapshot(db, input.settlementGroupId);
    await appendTimeline(db, {
      entityType: 'labor_job', entityId: finalAfter.jobId, action: 'settlement_group_receipt_posted', occurredAt: now, reason: null,
      before, after: { group: finalAfter, receipt: finalAfter.receipts.find((receipt) => receipt.id === receiptId)! }, personId: null, laborJobId: finalAfter.jobId,
    });
  });
  return receiptId;
};

export const editLaborSettlementGroupReceipt = async (db: SqlExecutor, receiptId: string, input: EditLaborSettlementGroupReceiptInput, now = timestamp()): Promise<void> => {
  const reason = trimmed(input.reason);
  if (!reason) throw new Error('TAKAI settlement group receipt edit requires a reason');
  assertDate(input.receiptDate, 'settlement group receipt date');
  assertPositiveSatang(input.amountSatang, 'settlement group receipt');
  await withTransaction(db, async () => {
    const row = (await db.getAllAsync<SettlementGroupReceiptRow>(
      `SELECT id, settlement_group_id, receipt_date, amount_satang, method, note, current_revision, status
       FROM labor_settlement_group_receipts WHERE id = ? AND status IN ('posted', 'revised') LIMIT 1`,
      [receiptId],
    ))[0];
    if (!row) throw new Error(`TAKAI settlement group receipt is unavailable: ${receiptId}`);
    const before = await settlementGroupSnapshot(db, row.settlement_group_id);
    const paidOutsideThisReceipt = before.paidSatang - Number(row.amount_satang);
    if (input.amountSatang > before.originalDueSatang - paidOutsideThisReceipt) {
      throw new Error('TAKAI settlement group receipt cannot exceed remaining balance');
    }
    await db.runAsync(
      `UPDATE labor_settlement_group_receipts
       SET receipt_date = ?, amount_satang = ?, method = ?, note = ?, current_revision = current_revision + 1, status = 'revised', updated_at = ?
       WHERE id = ? AND status IN ('posted', 'revised')`,
      [input.receiptDate, input.amountSatang, trimmed(input.method), trimmed(input.note), now, receiptId],
    );
    const after = await settlementGroupSnapshot(db, row.settlement_group_id);
    await db.runAsync(
      'UPDATE labor_settlement_groups SET status = ?, updated_at = ? WHERE id = ?',
      [after.remainingSatang === 0 ? 'settled' : 'open', now, row.settlement_group_id],
    );
    const finalAfter = await settlementGroupSnapshot(db, row.settlement_group_id);
    await appendTimeline(db, {
      entityType: 'labor_job', entityId: finalAfter.jobId, action: 'settlement_group_receipt_edited', occurredAt: now, reason,
      before: { group: before, receipt: before.receipts.find((receipt) => receipt.id === receiptId)! },
      after: { group: finalAfter, receipt: finalAfter.receipts.find((receipt) => receipt.id === receiptId)! },
      personId: null, laborJobId: finalAfter.jobId,
    });
  });
};

export const listLaborSettlementGroups = async (db: SqlExecutor, jobId?: string): Promise<LaborSettlementGroup[]> => {
  const groups = await settlementGroupRows(db, jobId);
  return Promise.all(groups.map((group) => settlementGroupSnapshot(db, group.id)));
};

export const listLaborWorkBasisSnapshots = async (db: SqlExecutor, jobId?: string): Promise<LaborWorkBasisSnapshot[]> => {
  if (jobId) return workBasisSnapshotsForJob(db, jobId);
  const rows = await db.getAllAsync<WorkBasisSnapshotRow>(
    `SELECT id, labor_job_id, settlement_route, basis_kind, stage, person_id, rate_satang, quantity_milli,
            NULL AS duration_minutes, unit_label, total_satang, note, created_at
     FROM labor_work_basis_snapshots
     UNION ALL
     SELECT id, labor_job_id, settlement_route, 'hourly' AS basis_kind, stage, person_id, rate_satang,
            NULL AS quantity_milli, duration_minutes, unit_label, total_satang, note, created_at
     FROM labor_hourly_work_basis_snapshots
     ORDER BY created_at ASC, id ASC`,
  );
  return rows.map((row) => ({
    id: row.id, jobId: row.labor_job_id, settlementRoute: row.settlement_route, basisKind: row.basis_kind,
    stage: row.stage, personId: row.person_id, rateSatang: row.rate_satang == null ? null : Number(row.rate_satang),
    quantityMilli: row.quantity_milli == null ? null : Number(row.quantity_milli), durationMinutes: row.duration_minutes == null ? null : Number(row.duration_minutes), unitLabel: row.unit_label,
    totalSatang: row.total_satang == null ? null : Number(row.total_satang), note: row.note, createdAt: row.created_at,
  }));
};

export const listLaborPayables = async (db: SqlExecutor, personId?: string): Promise<LaborPayable[]> => {
  const rows = await db.getAllAsync<PayableRow>(
    `SELECT payable.id, payable.labor_job_id, job.title, job.work_date, job.kind, payable.person_id, payable.due_satang,
       COALESCE((SELECT SUM(allocation.amount_satang)
        FROM labor_payment_allocations AS allocation
        JOIN labor_payment_batches AS batch ON batch.id = allocation.payment_batch_id
        WHERE allocation.payable_id = payable.id AND batch.status = 'posted'), 0)
       + COALESCE((SELECT SUM(session_allocation.amount_satang)
        FROM labor_payment_session_wage_allocations AS session_allocation
       JOIN labor_payment_session_settlements AS settlement ON settlement.id = session_allocation.settlement_id
       JOIN labor_payment_sessions AS session ON session.id = settlement.payment_session_id
        WHERE session_allocation.labor_payable_id = payable.id AND session.status IN ('posted', 'revised')), 0)
       - COALESCE((SELECT SUM(recovery.amount_satang)
        FROM labor_payment_session_advance_recoveries AS recovery
        JOIN labor_payment_session_settlements AS settlement ON settlement.id = recovery.settlement_id
        JOIN labor_payment_sessions AS session ON session.id = settlement.payment_session_id
        WHERE recovery.labor_payable_id = payable.id AND session.status IN ('posted', 'revised')), 0) AS paid_satang,
       COALESCE((SELECT SUM(deduction.amount_satang)
        FROM labor_advance_deductions AS deduction
        WHERE deduction.labor_payable_id = payable.id), 0)
       + COALESCE((SELECT SUM(recovery.amount_satang)
        FROM labor_payment_session_advance_recoveries AS recovery
        JOIN labor_payment_session_settlements AS settlement ON settlement.id = recovery.settlement_id
        JOIN labor_payment_sessions AS session ON session.id = settlement.payment_session_id
        WHERE recovery.labor_payable_id = payable.id AND session.status IN ('posted', 'revised')), 0) AS recovered_satang
     FROM labor_payables AS payable
     JOIN labor_jobs AS job ON job.id = payable.labor_job_id
     WHERE payable.status = 'open' AND job.status = 'open' ${personId ? 'AND payable.person_id = ?' : ''}
     ORDER BY job.work_date DESC, payable.created_at DESC`,
    personId ? [personId] : [],
  );
  return rows.map((row) => ({
    id: row.id, jobId: row.labor_job_id, jobTitle: row.title, workDate: row.work_date, personId: row.person_id,
    dueSatang: Number(row.due_satang), paidSatang: Number(row.paid_satang), recoveredSatang: Number(row.recovered_satang),
    remainingSatang: Number(row.due_satang) - Number(row.paid_satang) - Number(row.recovered_satang), kind: row.kind,
  }));
};

export const listLaborWorkerAdvances = async (db: SqlExecutor, personId?: string): Promise<LaborWorkerAdvance[]> => {
  const rows = await advanceRows(db, personId);
  return rows.map((row) => ({
    id: row.id, personId: row.person_id, advanceDate: row.advance_date, amountSatang: Number(row.amount_satang),
    recoveredSatang: Number(row.recovered_satang), remainingSatang: Number(row.amount_satang) - Number(row.recovered_satang),
    method: row.method, note: row.note, currentRevision: Number(row.current_revision), status: row.status,
  }));
};

export const listLaborAdvanceDeductions = async (db: SqlExecutor, personId?: string): Promise<LaborAdvanceDeduction[]> => {
  const rows = await db.getAllAsync<AdvanceDeductionRow>(
    `SELECT id, labor_worker_advance_id, labor_payable_id, person_id, recovery_date, amount_satang, note
     FROM labor_advance_deductions ${personId ? 'WHERE person_id = ?' : ''}
     ORDER BY recovery_date ASC, created_at ASC, id ASC`,
    personId ? [personId] : [],
  );
  return rows.map((row) => ({
    id: row.id, advanceId: row.labor_worker_advance_id, payableId: row.labor_payable_id, personId: row.person_id,
    recoveryDate: row.recovery_date, amountSatang: Number(row.amount_satang), note: row.note,
  }));
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

/** Unified new-ledger read model; old payment batches and group receipts remain available through their existing readers. */
export const listLaborPaymentSessions = async (db: SqlExecutor): Promise<LaborPaymentSession[]> => {
  const rows = await db.getAllAsync<PaymentSessionRow>(
    `SELECT id, payment_date, method, note, cash_paid_satang, current_revision, status, created_at
     FROM labor_payment_sessions WHERE status IN ('posted', 'revised')
     ORDER BY payment_date DESC, created_at DESC, id DESC`,
  );
  return Promise.all(rows.map((row) => paymentSessionSnapshot(db, row.id)));
};

export const listLaborContracts = async (db: SqlExecutor): Promise<LaborContract[]> => {
  const contracts = await db.getAllAsync<ContractJobRow>(
    `SELECT job.id, job.title, job.work_date, job.note, detail.starts_on, detail.deadline_on, detail.completed_on,
       detail.status, detail.agreed_total_satang, detail.final_total_satang
     FROM labor_jobs AS job
     JOIN labor_contract_details AS detail ON detail.labor_job_id = job.id
     WHERE job.kind = 'contract' ORDER BY job.work_date DESC, job.created_at DESC`,
  );
  return Promise.all(contracts.map(async (contract) => {
    const [participants, progress] = await Promise.all([
      db.getAllAsync<{ person_id: string; due_satang: number | null; paid_satang: number; recovered_satang: number }>(
        `SELECT participant.person_id, payable.due_satang,
           COALESCE((SELECT SUM(allocation.amount_satang)
            FROM labor_payment_allocations AS allocation
            JOIN labor_payment_batches AS batch ON batch.id = allocation.payment_batch_id
            WHERE allocation.payable_id = payable.id AND batch.status = 'posted'), 0) AS paid_satang,
           COALESCE((SELECT SUM(deduction.amount_satang)
            FROM labor_advance_deductions AS deduction
            WHERE deduction.labor_payable_id = payable.id), 0) AS recovered_satang
         FROM labor_job_participants AS participant
         LEFT JOIN labor_payables AS payable ON payable.participant_id = participant.id AND payable.status = 'open'
         WHERE participant.labor_job_id = ? AND participant.pay_type = 'contract'
         GROUP BY participant.id ORDER BY participant.sort_order ASC`,
        [contract.id],
      ),
      db.getAllAsync<{ id: string; progress_date: string; note: string; created_at: string }>(
        `SELECT id, progress_date, note, created_at FROM labor_job_progress
         WHERE labor_job_id = ? ORDER BY progress_date ASC, created_at ASC, id ASC`,
        [contract.id],
      ),
    ]);
    const totalSatang = contract.final_total_satang ?? contract.agreed_total_satang;
    const shareTotal = participants.reduce((sum, participant) => sum + Number(participant.due_satang ?? 0), 0);
    return {
      id: contract.id,
      title: contract.title,
      workDate: contract.work_date,
      note: contract.note,
      startsOn: contract.starts_on,
      deadlineOn: contract.deadline_on,
      completedOn: contract.completed_on,
      status: contract.status,
      totalSatang: totalSatang == null ? null : Number(totalSatang),
      isReconciled: totalSatang != null && shareTotal === Number(totalSatang) && participants.every((participant) => participant.due_satang != null),
      participants: participants.map((participant) => ({
        personId: participant.person_id,
        shareSatang: participant.due_satang == null ? null : Number(participant.due_satang),
        paidSatang: Number(participant.paid_satang),
        remainingSatang: participant.due_satang == null ? 0 : Number(participant.due_satang) - Number(participant.paid_satang) - Number(participant.recovered_satang),
      })),
      progress: progress.map((item): LaborContractProgress => ({ id: item.id, progressDate: item.progress_date, note: item.note, createdAt: item.created_at })),
    };
  }));
};

export const listLegacyLaborSources = async (db: SqlExecutor, includeImported = true): Promise<LegacyLaborSource[]> => {
  const rows = await db.getAllAsync<LegacySourceRow>(
    `SELECT entry.id, entry.person_id, entry.work_date, entry.amount_due, entry.amount_paid, batch.imported_at
     FROM labor_entries AS entry
     LEFT JOIN legacy_labor_import_links AS link ON link.legacy_labor_entry_id = entry.id
     LEFT JOIN legacy_labor_import_batches AS batch ON batch.id = link.import_batch_id
     WHERE entry.status = 'unpaid' AND entry.amount_due > entry.amount_paid ${includeImported ? '' : 'AND link.id IS NULL'}
     ORDER BY entry.work_date ASC, entry.id ASC`,
  );
  return rows.map((row) => ({
    legacyLaborEntryId: row.id,
    personId: row.person_id,
    workDate: row.work_date,
    amountDueBaht: Number(row.amount_due),
    amountPaidBaht: Number(row.amount_paid),
    remainingSatang: bahtToSatang(Number(row.amount_due) - Number(row.amount_paid), 'legacy remaining balance'),
    importedAt: row.imported_at,
  }));
};

export const listLegacyCarryForwardBalances = async (db: SqlExecutor): Promise<LegacyCarryForwardBalance[]> => {
  const payables = (await listLaborPayables(db)).filter((payable) => payable.kind === 'legacy_import');
  if (!payables.length) return [];
  const placeholders = payables.map(() => '?').join(', ');
  const links = await db.getAllAsync<{ labor_payable_id: string; legacy_labor_entry_id: string; source_work_date: string; source_due_satang: number }>(
    `SELECT labor_payable_id, legacy_labor_entry_id, source_work_date, source_due_satang
     FROM legacy_labor_import_links WHERE labor_payable_id IN (${placeholders})`,
    payables.map((payable) => payable.id),
  );
  const byPayable = new Map(links.map((link) => [link.labor_payable_id, link]));
  return payables.map((payable) => {
    const link = byPayable.get(payable.id);
    return {
      ...payable,
      sourceLaborEntryId: link?.legacy_labor_entry_id ?? null,
      sourceWorkDate: link?.source_work_date ?? null,
      sourceDueSatang: link ? Number(link.source_due_satang) : null,
      isManual: !link,
    };
  });
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
  const [workers, payables, payments, paymentSessions, timeline, contracts, legacySources, legacyBalances, settlementGroups, workBasisSnapshots, advances, advanceDeductions] = await Promise.all([
    listLaborWorkers(db, true), listLaborPayables(db), listLaborPayments(db), listLaborPaymentSessions(db), listLaborTimeline(db),
    listLaborContracts(db), listLegacyLaborSources(db), listLegacyCarryForwardBalances(db), listLaborSettlementGroups(db), listLaborWorkBasisSnapshots(db),
    listLaborWorkerAdvances(db), listLaborAdvanceDeductions(db),
  ]);
  const people: LaborPersonBalance[] = workers.map((worker) => {
    const rows = payables.filter((payable) => payable.personId === worker.id);
    const grossEarnedSatang = rows.reduce((sum, row) => sum + row.dueSatang, 0);
    const cashPaidSatang = rows.reduce((sum, row) => sum + row.paidSatang, 0);
    const wageRemainingSatang = rows.reduce((sum, row) => sum + row.remainingSatang, 0);
    const personAdvances = advances.filter((advance) => advance.personId === worker.id);
    const advanceIssuedSatang = personAdvances.reduce((sum, advance) => sum + advance.amountSatang, 0);
    const advanceRecoveredSatang = personAdvances.reduce((sum, advance) => sum + advance.recoveredSatang, 0);
    const advanceRemainingSatang = personAdvances.reduce((sum, advance) => sum + advance.remainingSatang, 0);
    return {
      ...worker, dueSatang: grossEarnedSatang, paidSatang: cashPaidSatang, remainingSatang: wageRemainingSatang,
      grossEarnedSatang, cashPaidSatang, wageRemainingSatang, advanceIssuedSatang, advanceRecoveredSatang, advanceRemainingSatang,
    };
  });
  return { people, payables, payments, paymentSessions, timeline, contracts, legacySources, legacyBalances, settlementGroups, workBasisSnapshots, advances, advanceDeductions };
};

type ProjectionJobRow = {
  id: string;
  title: string;
  work_date: string;
  note: string;
  kind: 'normal' | 'contract' | 'legacy_import';
  created_at: string;
  starts_on: string | null;
  deadline_on: string | null;
  completed_on: string | null;
  final_total_satang: number | null;
};
type ProjectionParticipantRow = { labor_job_id: string; person_id: string; display_name: string; pay_type: 'none' | 'daily' | 'hourly' | 'piece' | 'contract' };
type ProjectionPaymentRow = { id: string; person_id: string; display_name: string; payment_date: string; total_satang: number; note: string; created_at: string };
type ProjectionPaymentAllocationRow = { payment_batch_id: string; payable_id: string; labor_job_id: string; amount_satang: number };
type ProjectionReceiptRow = { id: string; labor_job_id: string; settlement_group_id: string; receipt_date: string; amount_satang: number; note: string; created_at: string; updated_at: string };
type ProjectionAdvanceRow = { id: string; person_id: string; display_name: string; advance_date: string; amount_satang: number; note: string; created_at: string };
type ProjectionRecoveryRow = { id: string; labor_worker_advance_id: string; labor_payable_id: string; person_id: string; display_name: string; labor_job_id: string; recovery_date: string; amount_satang: number; note: string; created_at: string };
type ProjectionProgressRow = { id: string; labor_job_id: string; progress_date: string; note: string; created_at: string };

const assertProjectionRange = (startDate: string, endDate: string): void => {
  assertDate(startDate, 'projection start date');
  assertDate(endDate, 'projection end date');
  if (startDate > endDate) throw new Error('TAKAI projection start date must not be after end date');
};

const enumerateDates = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const last = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

const paymentStateFor = (dueSatang: number, paidSatang: number, recoveredSatang: number): LaborPaymentState => {
  if (dueSatang <= 0) return 'not_applicable';
  const settledSatang = paidSatang + recoveredSatang;
  if (settledSatang >= dueSatang) return 'paid';
  return settledSatang > 0 ? 'partial' : 'unpaid';
};

const eventMatches = (event: LaborProjectionEvent, input: Omit<LaborCalendarRangeInput, 'startDate' | 'endDate'>): boolean => {
  if (input.personId && event.personId !== input.personId && !event.personIds.includes(input.personId)) return false;
  if (input.eventTypes?.length && !input.eventTypes.includes(event.eventType)) return false;
  if (input.paymentState && event.paymentState !== input.paymentState) return false;
  if (input.settlementRoute && event.settlementRoute !== input.settlementRoute) return false;
  const keyword = trimmed(input.keyword).toLocaleLowerCase();
  if (keyword && !`${event.label} ${event.detail}`.toLocaleLowerCase().includes(keyword)) return false;
  return true;
};

const summarizeCalendarDay = (date: string, events: LaborProjectionEvent[]): LaborCalendarDaySummary => ({
  date,
  events,
  workCount: events.filter((event) => event.eventType === 'work').length,
  workDueSatang: events.filter((event) => event.eventType === 'work').reduce((sum, event) => sum + event.dueSatang, 0),
  individualPaymentSatang: events.filter((event) => event.eventType === 'individual_payment').reduce((sum, event) => sum + event.amountSatang, 0),
  paymentSessionCashSatang: events.filter((event) => event.eventType === 'payment_session').reduce((sum, event) => sum + event.amountSatang, 0),
  groupReceiptSatang: events.filter((event) => event.eventType === 'group_receipt').reduce((sum, event) => sum + event.amountSatang, 0),
  advanceIssuedSatang: events.filter((event) => event.eventType === 'advance').reduce((sum, event) => sum + event.amountSatang, 0),
  advanceRecoveredSatang: events.filter((event) => event.eventType === 'advance_recovery').reduce((sum, event) => sum + event.amountSatang, 0),
  contractProgressCount: events.filter((event) => event.eventType === 'contract_progress').length,
  contractCompletionCount: events.filter((event) => event.eventType === 'contract_completion').length,
  contractDeadlineCount: events.filter((event) => event.eventType === 'contract_deadline').length,
});

/** Repository-owned projection: consumers receive typed business events, never timeline JSON. */
const listLaborProjectionEvents = async (db: SqlExecutor): Promise<LaborProjectionEvent[]> => {
  const [jobs, participants, payables, groups, snapshots, contracts, paymentRows, paymentAllocations, paymentSessions, receipts, advances, recoveries, progress] = await Promise.all([
    db.getAllAsync<ProjectionJobRow>(
      `SELECT job.id, job.title, job.work_date, job.note, job.kind, job.created_at,
              detail.starts_on, detail.deadline_on, detail.completed_on, detail.final_total_satang
       FROM labor_jobs AS job
       LEFT JOIN labor_contract_details AS detail ON detail.labor_job_id = job.id
       WHERE job.status = 'open' ORDER BY job.work_date ASC, job.created_at ASC, job.id ASC`,
    ),
    db.getAllAsync<ProjectionParticipantRow>(
      `SELECT participant.labor_job_id, participant.person_id, person.display_name, participant.pay_type
       FROM labor_job_participants AS participant JOIN people AS person ON person.id = participant.person_id
       ORDER BY participant.labor_job_id ASC, participant.sort_order ASC, participant.id ASC`,
    ),
    listLaborPayables(db),
    listLaborSettlementGroups(db),
    listLaborWorkBasisSnapshots(db),
    listLaborContracts(db),
    db.getAllAsync<ProjectionPaymentRow>(
      `SELECT payment.id, payment.person_id, person.display_name, payment.payment_date, payment.total_satang, payment.note, payment.created_at
       FROM labor_payment_batches AS payment JOIN people AS person ON person.id = payment.person_id
       WHERE payment.status IN ('posted', 'revised') ORDER BY payment.payment_date ASC, payment.created_at ASC, payment.id ASC`,
    ),
    db.getAllAsync<ProjectionPaymentAllocationRow>(
      `SELECT allocation.payment_batch_id, allocation.payable_id, payable.labor_job_id, allocation.amount_satang
       FROM labor_payment_allocations AS allocation
       JOIN labor_payment_batches AS payment ON payment.id = allocation.payment_batch_id
       JOIN labor_payables AS payable ON payable.id = allocation.payable_id
       WHERE payment.status IN ('posted', 'revised') ORDER BY allocation.id ASC`,
    ),
    listLaborPaymentSessions(db),
    db.getAllAsync<ProjectionReceiptRow>(
      `SELECT receipt.id, settlement_group.labor_job_id, receipt.settlement_group_id, receipt.receipt_date,
              receipt.amount_satang, receipt.note, receipt.created_at, receipt.updated_at
       FROM labor_settlement_group_receipts AS receipt
       JOIN labor_settlement_groups AS settlement_group ON settlement_group.id = receipt.settlement_group_id
       WHERE receipt.status IN ('posted', 'revised') ORDER BY receipt.receipt_date ASC, receipt.created_at ASC, receipt.id ASC`,
    ),
    db.getAllAsync<ProjectionAdvanceRow>(
      `SELECT advance.id, advance.person_id, person.display_name, advance.advance_date, advance.amount_satang, advance.note, advance.created_at
       FROM labor_worker_advances AS advance JOIN people AS person ON person.id = advance.person_id
       WHERE advance.status IN ('posted', 'revised') ORDER BY advance.advance_date ASC, advance.created_at ASC, advance.id ASC`,
    ),
    db.getAllAsync<ProjectionRecoveryRow>(
      `SELECT deduction.id, deduction.labor_worker_advance_id, deduction.labor_payable_id, deduction.person_id,
              person.display_name, payable.labor_job_id, deduction.recovery_date, deduction.amount_satang, deduction.note, deduction.created_at
       FROM labor_advance_deductions AS deduction
       JOIN people AS person ON person.id = deduction.person_id
       JOIN labor_payables AS payable ON payable.id = deduction.labor_payable_id
       ORDER BY deduction.recovery_date ASC, deduction.created_at ASC, deduction.id ASC`,
    ),
    db.getAllAsync<ProjectionProgressRow>(
      `SELECT id, labor_job_id, progress_date, note, created_at FROM labor_job_progress
       ORDER BY progress_date ASC, created_at ASC, id ASC`,
    ),
  ]);

  const participantsByJob = new Map<string, ProjectionParticipantRow[]>();
  participants.forEach((participant) => participantsByJob.set(participant.labor_job_id, [...(participantsByJob.get(participant.labor_job_id) ?? []), participant]));
  const payablesByJob = new Map<string, LaborPayable[]>();
  payables.forEach((payable) => payablesByJob.set(payable.jobId, [...(payablesByJob.get(payable.jobId) ?? []), payable]));
  const groupByJob = new Map(groups.map((group) => [group.jobId, group]));
  const routeByJob = new Map<string, LaborSettlementRoute>();
  snapshots.forEach((snapshot) => routeByJob.set(snapshot.jobId, snapshot.settlementRoute));
  const completedContractSnapshotByJob = new Map(snapshots.filter((snapshot) => snapshot.basisKind === 'contract' && snapshot.stage === 'completed').map((snapshot) => [snapshot.jobId, snapshot]));
  groups.forEach((group) => routeByJob.set(group.jobId, 'group'));
  const contractByJob = new Map(contracts.map((contract) => [contract.id, contract]));
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const payableById = new Map(payables.map((payable) => [payable.id, payable]));
  const allocationsByPayment = new Map<string, ProjectionPaymentAllocationRow[]>();
  paymentAllocations.forEach((allocation) => allocationsByPayment.set(allocation.payment_batch_id, [...(allocationsByPayment.get(allocation.payment_batch_id) ?? []), allocation]));
  const events: LaborProjectionEvent[] = [];

  for (const job of jobs) {
    const jobParticipants = participantsByJob.get(job.id) ?? [];
    const jobPayables = payablesByJob.get(job.id) ?? [];
    const group = groupByJob.get(job.id) ?? null;
    const route = routeByJob.get(job.id) ?? 'individual';
    const dueSatang = group?.originalDueSatang ?? jobPayables.reduce((sum, payable) => sum + payable.dueSatang, 0);
    const paidSatang = group?.paidSatang ?? jobPayables.reduce((sum, payable) => sum + payable.paidSatang, 0);
    const recoveredSatang = group ? 0 : jobPayables.reduce((sum, payable) => sum + payable.recoveredSatang, 0);
    const remainingSatang = group?.remainingSatang ?? jobPayables.reduce((sum, payable) => sum + payable.remainingSatang, 0);
    const state = paymentStateFor(dueSatang, paidSatang, recoveredSatang);
    const participantNames = jobParticipants.map((participant) => participant.display_name).join(' · ');
    events.push({
      id: `work:${job.id}`, eventType: 'work', effectiveDate: job.work_date, recordedAt: job.created_at,
      label: job.title, detail: participantNames, jobId: job.id, jobIds: [job.id], personId: null,
      personIds: jobParticipants.map((participant) => participant.person_id), settlementGroupId: group?.id ?? null,
      settlementRoute: route, paymentState: state, amountSatang: 0, dueSatang, remainingSatang,
    });
    if (job.kind !== 'contract') continue;
    const contract = contractByJob.get(job.id);
    if (job.starts_on) events.push({
      id: `contract-start:${job.id}`, eventType: 'contract_start', effectiveDate: job.starts_on, recordedAt: job.created_at,
      label: job.title, detail: 'เริ่มงานเหมา', jobId: job.id, jobIds: [job.id], personId: null,
      personIds: jobParticipants.map((participant) => participant.person_id), settlementGroupId: group?.id ?? null,
      settlementRoute: route, paymentState: state, amountSatang: 0, dueSatang: 0, remainingSatang,
    });
    if (job.deadline_on) events.push({
      id: `contract-deadline:${job.id}`, eventType: 'contract_deadline', effectiveDate: job.deadline_on, recordedAt: job.created_at,
      label: job.title, detail: 'กำหนดส่งงานเหมา', jobId: job.id, jobIds: [job.id], personId: null,
      personIds: jobParticipants.map((participant) => participant.person_id), settlementGroupId: group?.id ?? null,
      settlementRoute: route, paymentState: state, amountSatang: 0, dueSatang: 0, remainingSatang,
    });
    if (job.completed_on) events.push({
      id: `contract-completion:${job.id}`, eventType: 'contract_completion', effectiveDate: job.completed_on, recordedAt: completedContractSnapshotByJob.get(job.id)?.createdAt ?? job.created_at,
      label: job.title, detail: 'สรุปงานเหมา', jobId: job.id, jobIds: [job.id], personId: null,
      personIds: jobParticipants.map((participant) => participant.person_id), settlementGroupId: group?.id ?? null,
      settlementRoute: route, paymentState: state, amountSatang: 0, dueSatang: Number(job.final_total_satang ?? contract?.totalSatang ?? 0), remainingSatang,
    });
  }

  progress.forEach((item) => {
    const job = jobById.get(item.labor_job_id);
    if (!job) return;
    const group = groupByJob.get(job.id) ?? null;
    const jobPayables = payablesByJob.get(job.id) ?? [];
    const route = routeByJob.get(job.id) ?? 'individual';
    const dueSatang = group?.originalDueSatang ?? jobPayables.reduce((sum, payable) => sum + payable.dueSatang, 0);
    const paidSatang = group?.paidSatang ?? jobPayables.reduce((sum, payable) => sum + payable.paidSatang, 0);
    const recoveredSatang = group ? 0 : jobPayables.reduce((sum, payable) => sum + payable.recoveredSatang, 0);
    events.push({
      id: `contract-progress:${item.id}`, eventType: 'contract_progress', effectiveDate: item.progress_date, recordedAt: item.created_at,
      label: job.title, detail: item.note, jobId: job.id, jobIds: [job.id], personId: null,
      personIds: (participantsByJob.get(job.id) ?? []).map((participant) => participant.person_id), settlementGroupId: group?.id ?? null,
      settlementRoute: route, paymentState: paymentStateFor(dueSatang, paidSatang, recoveredSatang), amountSatang: 0, dueSatang: 0,
      remainingSatang: group?.remainingSatang ?? jobPayables.reduce((sum, payable) => sum + payable.remainingSatang, 0),
    });
  });

  paymentRows.forEach((payment) => {
    const allocations = allocationsByPayment.get(payment.id) ?? [];
    const jobIds = [...new Set(allocations.map((allocation) => allocation.labor_job_id))];
    const jobTitles = jobIds.map((jobId) => jobById.get(jobId)?.title).filter((title): title is string => Boolean(title));
    events.push({
      id: `payment:${payment.id}`, eventType: 'individual_payment', effectiveDate: payment.payment_date, recordedAt: payment.created_at,
      label: `จ่ายค่าแรง · ${payment.display_name}`, detail: jobTitles.join(' · ') || payment.note, jobId: jobIds.length === 1 ? jobIds[0]! : null,
      jobIds, personId: payment.person_id, personIds: [payment.person_id], settlementGroupId: null, settlementRoute: 'individual',
      paymentState: 'not_applicable', amountSatang: Number(payment.total_satang), dueSatang: 0, remainingSatang: 0,
    });
  });

  paymentSessions.forEach((session) => {
    const personIds = session.settlements.flatMap((settlement) => settlement.personId ? [settlement.personId] : []);
    const groupSettlements = session.settlements.filter((settlement) => settlement.settlementGroupId);
    const jobIds = [...new Set([
      ...session.settlements.flatMap((settlement) => settlement.wageAllocations.map((allocation) => payableById.get(allocation.payableId)?.jobId).filter((jobId): jobId is string => Boolean(jobId))),
      ...groupSettlements.map((settlement) => groups.find((group) => group.id === settlement.settlementGroupId)?.jobId).filter((jobId): jobId is string => Boolean(jobId)),
    ])];
    const routeValues = new Set(session.settlements.map((settlement) => settlement.recipientType));
    events.push({
      id: `payment-session:${session.id}`, eventType: 'payment_session', effectiveDate: session.paymentDate, recordedAt: session.createdAt,
      label: `จ่ายเงิน ${session.settlements.length} รายการ`, detail: session.note, jobId: jobIds.length === 1 ? jobIds[0]! : null,
      jobIds, personId: personIds.length === 1 ? personIds[0]! : null, personIds,
      settlementGroupId: groupSettlements.length === 1 ? groupSettlements[0]!.settlementGroupId : null,
      settlementRoute: routeValues.size === 1 ? [...routeValues][0] === 'person' ? 'individual' : 'group' : null,
      paymentState: 'not_applicable', amountSatang: session.cashPaidSatang, dueSatang: 0, remainingSatang: 0,
    });
  });

  receipts.forEach((receipt) => {
    const job = jobById.get(receipt.labor_job_id);
    if (!job) return;
    const group = groupByJob.get(job.id);
    events.push({
      id: `group-receipt:${receipt.id}`, eventType: 'group_receipt', effectiveDate: receipt.receipt_date,
      recordedAt: receipt.updated_at, label: `รับเงินชุดงาน · ${job.title}`, detail: receipt.note || group?.collectorLabel || '',
      jobId: job.id, jobIds: [job.id], personId: null, personIds: [], settlementGroupId: receipt.settlement_group_id,
      settlementRoute: 'group', paymentState: 'not_applicable', amountSatang: Number(receipt.amount_satang), dueSatang: 0,
      remainingSatang: group?.remainingSatang ?? 0,
    });
  });

  advances.forEach((advance) => events.push({
    id: `advance:${advance.id}`, eventType: 'advance', effectiveDate: advance.advance_date, recordedAt: advance.created_at,
    label: `เงินเบิก · ${advance.display_name}`, detail: advance.note, jobId: null, jobIds: [], personId: advance.person_id,
    personIds: [advance.person_id], settlementGroupId: null, settlementRoute: null, paymentState: 'not_applicable',
    amountSatang: Number(advance.amount_satang), dueSatang: 0, remainingSatang: 0,
  }));
  recoveries.forEach((recovery) => {
    const job = jobById.get(recovery.labor_job_id);
    events.push({
      id: `recovery:${recovery.id}`, eventType: 'advance_recovery', effectiveDate: recovery.recovery_date, recordedAt: recovery.created_at,
      label: `หักคืนเงินเบิก · ${recovery.display_name}`, detail: job?.title ?? recovery.note, jobId: recovery.labor_job_id,
      jobIds: [recovery.labor_job_id], personId: recovery.person_id, personIds: [recovery.person_id], settlementGroupId: null,
      settlementRoute: 'individual', paymentState: 'not_applicable', amountSatang: Number(recovery.amount_satang), dueSatang: 0, remainingSatang: 0,
    });
  });

  return events.sort((left, right) => `${left.effectiveDate}|${left.recordedAt}|${left.id}`.localeCompare(`${right.effectiveDate}|${right.recordedAt}|${right.id}`));
};

export const getLaborCalendarRange = async (db: SqlExecutor, input: LaborCalendarRangeInput): Promise<LaborCalendarRange> => {
  assertProjectionRange(input.startDate, input.endDate);
  const events = (await listLaborProjectionEvents(db)).filter((event) => event.effectiveDate >= input.startDate && event.effectiveDate <= input.endDate && eventMatches(event, input));
  return {
    startDate: input.startDate,
    endDate: input.endDate,
    days: enumerateDates(input.startDate, input.endDate).map((date) => summarizeCalendarDay(date, events.filter((event) => event.effectiveDate === date))),
  };
};

export const getLaborHistory = async (db: SqlExecutor, input: LaborHistoryInput): Promise<LaborHistory> => {
  assertProjectionRange(input.startDate, input.endDate);
  if (input.limit !== undefined && (!Number.isSafeInteger(input.limit) || input.limit <= 0)) throw new Error('TAKAI history limit must be a positive whole number');
  const all = (await listLaborProjectionEvents(db))
    .filter((event) => event.effectiveDate >= input.startDate && event.effectiveDate <= input.endDate && eventMatches(event, input))
    .sort((left, right) => `${right.effectiveDate}|${right.recordedAt}|${right.id}`.localeCompare(`${left.effectiveDate}|${left.recordedAt}|${left.id}`));
  return { events: input.limit ? all.slice(0, input.limit) : all, total: all.length };
};

export const getLaborTodaySummary = async (db: SqlExecutor, date = localDateKey()): Promise<LaborTodaySummary> => {
  assertDate(date, 'today summary date');
  const [range, read] = await Promise.all([getLaborCalendarRange(db, { startDate: date, endDate: date }), getLaborMvpReadModel(db)]);
  return {
    date,
    day: range.days[0]!,
    unpaidPeople: read.people.filter((person) => person.wageRemainingSatang > 0),
    advanceAttentionPeople: read.people.filter((person) => person.advanceRemainingSatang > 0),
  };
};

export const getLaborJobDetail = async (db: SqlExecutor, jobId: string): Promise<LaborJobDetail | null> => {
  const jobs = await db.getAllAsync<ProjectionJobRow>(
    `SELECT job.id, job.title, job.work_date, job.note, job.kind, job.created_at,
            detail.starts_on, detail.deadline_on, detail.completed_on, detail.final_total_satang
     FROM labor_jobs AS job LEFT JOIN labor_contract_details AS detail ON detail.labor_job_id = job.id
     WHERE job.id = ? AND job.status = 'open' LIMIT 1`, [jobId],
  );
  const job = jobs[0];
  if (!job) return null;
  const [events, participants, payables, groups, contracts, snapshots] = await Promise.all([
    listLaborProjectionEvents(db),
    db.getAllAsync<ProjectionParticipantRow>(
      `SELECT participant.labor_job_id, participant.person_id, person.display_name, participant.pay_type
       FROM labor_job_participants AS participant JOIN people AS person ON person.id = participant.person_id
       WHERE participant.labor_job_id = ? ORDER BY participant.sort_order ASC, participant.id ASC`, [jobId],
    ),
    listLaborPayables(db), listLaborSettlementGroups(db, jobId), listLaborContracts(db), listLaborWorkBasisSnapshots(db, jobId),
  ]);
  const group = groups[0] ?? null;
  const jobPayables = payables.filter((payable) => payable.jobId === jobId);
  const route = group ? 'group' : snapshots[0]?.settlementRoute ?? 'individual';
  const dueSatang = group?.originalDueSatang ?? jobPayables.reduce((sum, payable) => sum + payable.dueSatang, 0);
  const cashPaidSatang = group?.paidSatang ?? jobPayables.reduce((sum, payable) => sum + payable.paidSatang, 0);
  const advanceRecoveredSatang = group ? 0 : jobPayables.reduce((sum, payable) => sum + payable.recoveredSatang, 0);
  const remainingSatang = group?.remainingSatang ?? jobPayables.reduce((sum, payable) => sum + payable.remainingSatang, 0);
  return {
    id: job.id, title: job.title, kind: job.kind, workDate: job.work_date, note: job.note, createdAt: job.created_at,
    settlementRoute: route, paymentState: paymentStateFor(dueSatang, cashPaidSatang, advanceRecoveredSatang), dueSatang, cashPaidSatang,
    advanceRecoveredSatang, remainingSatang,
    participants: participants.map((participant) => ({ personId: participant.person_id, displayName: participant.display_name, payType: participant.pay_type })),
    settlementGroup: group, contract: contracts.find((contract) => contract.id === jobId) ?? null, workBasisSnapshots: snapshots,
    events: events.filter((event) => event.jobId === jobId || event.jobIds.includes(jobId)),
  };
};

export const getLaborPersonDetail = async (db: SqlExecutor, personId: string): Promise<LaborPersonDetail | null> => {
  const [read, events, wagePayables, advances, advanceDeductions] = await Promise.all([
    getLaborMvpReadModel(db), listLaborProjectionEvents(db), listLaborPayables(db, personId), listLaborWorkerAdvances(db, personId), listLaborAdvanceDeductions(db, personId),
  ]);
  const person = read.people.find((item) => item.id === personId);
  if (!person) return null;
  return { person, wagePayables, advances, advanceDeductions, events: events.filter((event) => event.personId === personId || event.personIds.includes(personId)) };
};
