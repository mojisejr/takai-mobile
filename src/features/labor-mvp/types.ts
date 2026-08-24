export type LaborPayType = 'none' | 'daily' | 'hourly' | 'piece' | 'contract';
export type LaborSettlementRoute = 'individual' | 'group';
export type LaborWorkBasisKind = 'daily' | 'hourly' | 'piece' | 'contract';

export type LaborWorkerInput = {
  id?: string;
  displayName: string;
  specialty?: string;
  phone?: string;
  note?: string;
};

export type UpdateLaborWorkerInput = {
  displayName?: string;
  specialty?: string;
  phone?: string;
  note?: string;
  reason: string;
};

export type NormalWorkParticipantInput = {
  personId: string;
  dueSatang?: number;
  payType?: Exclude<LaborPayType, 'none' | 'contract'>;
  note?: string;
  participantId?: string;
  payableId?: string;
  rateSatang?: number;
  quantityMilli?: number;
  durationMinutes?: number;
  unitLabel?: string;
};

export type CreateNormalWorkInput = {
  id?: string;
  title: string;
  workDate: string;
  note?: string;
  participants: NormalWorkParticipantInput[];
};

export type ContractParticipantInput = {
  personId: string;
  note?: string;
  participantId?: string;
};

export type CreateLaborContractInput = {
  id?: string;
  title: string;
  workDate: string;
  startsOn?: string;
  deadlineOn?: string;
  note?: string;
  participants: ContractParticipantInput[];
  settlementRoute?: LaborSettlementRoute;
};

export type AddContractProgressInput = {
  id?: string;
  progressDate: string;
  note: string;
  quantityMilli?: number;
  unitLabel?: string;
};

export type CompleteLaborContractWorkInput = {
  id?: string;
  completedOn: string;
  finalTotalSatang: number;
  rateSatang?: number;
  quantityMilli?: number;
  unitLabel?: string;
  note?: string;
};

export type CreateGroupPieceWorkInput = {
  id?: string;
  settlementGroupId?: string;
  title: string;
  workDate: string;
  note?: string;
  memberPersonIds: string[];
  quantityMilli: number;
  rateSatang: number;
  unitLabel: string;
  collectorPersonId?: string;
  collectorLabel?: string;
};

/**
 * One row from the work-record notebook.  The enclosing command supplies the
 * shared effective work date; every row still becomes its own labor job.
 */
export type RecordIndividualLaborWorkItemInput = Omit<CreateNormalWorkInput, 'workDate'> & {
  settlementRoute: 'individual';
};

export type RecordGroupPieceLaborWorkItemInput = Omit<CreateGroupPieceWorkInput, 'workDate'> & {
  settlementRoute: 'group';
};

export type RecordLaborWorkItemInput = RecordIndividualLaborWorkItemInput | RecordGroupPieceLaborWorkItemInput;

export type RecordLaborWorkItemsInput = {
  workDate: string;
  items: RecordLaborWorkItemInput[];
};

export type RecordedLaborWorkItem =
  | { settlementRoute: 'individual'; jobId: string; payableIds: string[] }
  | { settlementRoute: 'group'; jobId: string; settlementGroupId: string };

export type ContractShareInput = {
  personId: string;
  amountSatang: number;
  payableId?: string;
};

export type ReconcileContractSharesInput = {
  totalSatang: number;
  shares: ContractShareInput[];
  reason?: string;
};

export type ImportLegacyLaborEntriesInput = {
  id?: string;
  legacyLaborEntryIds: string[];
  note?: string;
};

export type CreateManualOpeningBalanceInput = {
  id?: string;
  personId: string;
  workDate: string;
  dueSatang: number;
  title?: string;
  note?: string;
  participantId?: string;
  payableId?: string;
};

export type PaymentAllocationInput = {
  payableId: string;
  amountSatang: number;
  id?: string;
};

export type PostLaborPaymentInput = {
  id?: string;
  personId: string;
  paymentDate: string;
  method?: string;
  note?: string;
  allocations: PaymentAllocationInput[];
};

export type EditLaborPaymentInput = Omit<PostLaborPaymentInput, 'id' | 'personId'> & {
  reason: string;
};

export type CreateLaborSettlementGroupInput = {
  id?: string;
  laborJobId: string;
  originalDueSatang: number;
  memberPersonIds: string[];
  collectorPersonId?: string;
  collectorLabel?: string;
};

export type PostLaborSettlementGroupReceiptInput = {
  id?: string;
  settlementGroupId: string;
  receiptDate: string;
  amountSatang: number;
  method?: string;
  note?: string;
};

export type EditLaborSettlementGroupReceiptInput = Omit<PostLaborSettlementGroupReceiptInput, 'id' | 'settlementGroupId'> & {
  reason: string;
};

export type CreateLaborWorkerAdvanceInput = {
  id?: string;
  personId: string;
  advanceDate: string;
  amountSatang: number;
  method?: string;
  note?: string;
};

export type EditLaborWorkerAdvanceInput = Omit<CreateLaborWorkerAdvanceInput, 'id' | 'personId'> & {
  reason: string;
};

export type ApplyLaborAdvanceDeductionInput = {
  id?: string;
  advanceId: string;
  payableId: string;
  recoveryDate: string;
  amountSatang: number;
  note?: string;
};

export type PaymentSessionAdvanceRecoveryInput = {
  id?: string;
  advanceId: string;
  payableId: string;
  amountSatang: number;
};

export type PaymentSessionPersonSettlementInput = {
  id?: string;
  recipientType: 'person';
  personId: string;
  wageAllocations: PaymentAllocationInput[];
  bonusSatang?: number;
  advanceRecoveries?: PaymentSessionAdvanceRecoveryInput[];
};

export type PaymentSessionGroupSettlementInput = {
  id?: string;
  recipientType: 'group';
  settlementGroupId: string;
  wageSatang: number;
  bonusSatang?: number;
};

export type PaymentSessionSettlementInput = PaymentSessionPersonSettlementInput | PaymentSessionGroupSettlementInput;

/**
 * Both pay-by-work and pay-by-person use this same command. Their route only
 * decides how the caller preselects recipient rows; it does not alter ledger truth.
 */
export type PostLaborPaymentSessionInput = {
  id?: string;
  paymentDate: string;
  method?: string;
  note?: string;
  settlements: PaymentSessionSettlementInput[];
};

export type CorrectLaborPaymentSessionInput = Omit<PostLaborPaymentSessionInput, 'id'> & {
  reason: string;
};

export type LaborWorker = {
  id: string;
  displayName: string;
  specialty: string;
  phone: string;
  note: string;
  archivedAt: string | null;
};

export type LaborPayable = {
  id: string;
  jobId: string;
  jobTitle: string;
  workDate: string;
  personId: string;
  dueSatang: number;
  paidSatang: number;
  recoveredSatang: number;
  remainingSatang: number;
  kind: 'normal' | 'contract' | 'legacy_import';
};

export type LaborWorkerAdvance = {
  id: string;
  personId: string;
  advanceDate: string;
  amountSatang: number;
  recoveredSatang: number;
  remainingSatang: number;
  method: string;
  note: string;
  currentRevision: number;
  status: 'posted' | 'revised' | 'cancelled';
};

export type LaborAdvanceDeduction = {
  id: string;
  advanceId: string;
  payableId: string;
  personId: string;
  recoveryDate: string;
  amountSatang: number;
  note: string;
};

export type LaborPayment = {
  id: string;
  personId: string;
  paymentDate: string;
  method: string;
  note: string;
  totalSatang: number;
  currentRevision: number;
  allocations: Array<{ id: string; payableId: string; amountSatang: number }>;
};

export type LaborPaymentSessionAdvanceRecovery = {
  id: string;
  advanceId: string;
  payableId: string;
  amountSatang: number;
};

export type LaborPaymentSessionSettlement = {
  id: string;
  recipientType: 'person' | 'group';
  personId: string | null;
  settlementGroupId: string | null;
  wageSatang: number;
  bonusSatang: number;
  advanceRecoveredSatang: number;
  cashPaidSatang: number;
  wageAllocations: Array<{ id: string; payableId: string; amountSatang: number }>;
  advanceRecoveries: LaborPaymentSessionAdvanceRecovery[];
};

export type LaborPaymentSession = {
  id: string;
  paymentDate: string;
  method: string;
  note: string;
  cashPaidSatang: number;
  currentRevision: number;
  status: 'posted' | 'revised' | 'cancelled';
  createdAt: string;
  settlements: LaborPaymentSessionSettlement[];
};

export type LaborSettlementGroupReceipt = {
  id: string;
  settlementGroupId: string;
  receiptDate: string;
  amountSatang: number;
  method: string;
  note: string;
  currentRevision: number;
  status: 'posted' | 'revised' | 'cancelled';
};

export type LaborSettlementGroup = {
  id: string;
  jobId: string;
  originalDueSatang: number;
  paidSatang: number;
  remainingSatang: number;
  status: 'open' | 'settled' | 'cancelled';
  collectorPersonId: string | null;
  collectorLabel: string;
  memberPersonIds: string[];
  receipts: LaborSettlementGroupReceipt[];
};

export type LaborWorkBasisSnapshot = {
  id: string;
  jobId: string;
  settlementRoute: LaborSettlementRoute;
  basisKind: LaborWorkBasisKind;
  stage: 'recorded' | 'started' | 'progress' | 'completed';
  personId: string | null;
  rateSatang: number | null;
  quantityMilli: number | null;
  durationMinutes: number | null;
  unitLabel: string;
  totalSatang: number | null;
  note: string;
  createdAt: string;
};

export type LaborTimelineEvent = {
  id: string;
  entityType: 'person' | 'labor_job' | 'labor_payment';
  entityId: string;
  action: string;
  occurredAt: string;
  reason: string | null;
  before: unknown | null;
  after: unknown;
  personId: string | null;
  laborJobId: string | null;
};

export type LaborPersonBalance = LaborWorker & {
  /** Legacy aliases for gross earned wage, cash paid, and wage remaining. */
  dueSatang: number;
  paidSatang: number;
  remainingSatang: number;
  grossEarnedSatang: number;
  cashPaidSatang: number;
  wageRemainingSatang: number;
  advanceIssuedSatang: number;
  advanceRecoveredSatang: number;
  advanceRemainingSatang: number;
};

/**
 * V2 deliberately separates the record of work from the amount owed.  These
 * facts are parallel to the v1 job/payable ledger; they never reinterpret it.
 */
export type LaborV2TaskFact = {
  id: string;
  workDate: string;
  title: string;
  note?: string;
  assigneePersonIds: string[];
};

export type LaborV2DailyIntent = {
  id: string;
  personId: string;
  workDate: string;
  rateSatang: number;
  quantityMilli: 500 | 1000;
  taskIds: string[];
};

export type LaborV2HourlyTimeIntent = {
  id: string;
  taskId: string;
  personId: string;
  workDate: string;
  rateSatang: number;
  shiftKey?: string;
  durationMinutes: number;
};

export type LaborV2HourlyShiftIntent = {
  id: string;
  personId: string;
  workDate: string;
  rateSatang: number;
  shiftKey: string;
  durationMinutes: number;
  totalSatang: number;
  taskTimeEntryIds: string[];
};

export type LaborV2ContractBatchIntent = {
  id: string;
  title: string;
  startsOn: string;
  memberPersonIds: string[];
  taskIds?: string[];
  deadlineOn?: string;
  finalization?:
    | { kind: 'quantity_rate'; quantityMilli: number; rateSatang: number; unitLabel: string }
    | { kind: 'lump_total'; finalTotalSatang: number };
};

export type LaborV2ObligationIntent = {
  id: string;
  sourceKind: 'daily' | 'hourly' | 'contract';
  sourceUnitId: string;
  recipientKind: 'person' | 'group';
  personId: string | null;
  dueSatang: number;
};

/** V2 payment settlement facts remain separate from both v1 payment batches and work tasks. */
export type LaborV2PaymentRecipientSettlement = {
  id: string;
  paymentSessionId: string;
  obligationId: string;
  recipientKind: 'person' | 'group';
  personId: string | null;
  wageSatang: number;
  bonusSatang: number;
  advanceRecoveredSatang: number;
  cashPaidSatang: number;
};

/** Recovery remains person-only by command validation in Phase 2; this row keeps its audit links now. */
export type LaborV2PaymentAdvanceRecovery = {
  id: string;
  recipientSettlementId: string;
  advanceId: string;
  obligationId: string;
  personId: string;
  amountSatang: number;
};

export type LaborV2CompensationPlan = {
  dailyUnits: Array<LaborV2DailyIntent & { dueSatang: number }>;
  hourlyShifts: LaborV2HourlyShiftIntent[];
  contractBatches: Array<LaborV2ContractBatchIntent & { status: 'open' | 'finalized'; dueSatang: number | null }>;
  obligations: LaborV2ObligationIntent[];
};

export type RecordLaborDayV2Input = {
  workDate: string;
  tasks: Array<{ id?: string; title: string; note?: string; assigneePersonIds: string[] }>;
  daily?: Array<{ id?: string; personId: string; rateSatang: number; quantityMilli: 500 | 1000; taskIds: string[] }>;
  hourly?: Array<{ id?: string; taskId: string; personId: string; rateSatang: number; shiftKey?: string; durationMinutes: number; note?: string }>;
};

export type StartLaborContractBatchV2Input = { id?: string; title: string; startsOn: string; deadlineOn?: string; note?: string; memberPersonIds: string[]; taskIds?: string[] };
export type RecordLaborContractProgressV2Input = { id?: string; progressDate: string; note?: string; quantityMilli?: number; unitLabel?: string };
export type FinalizeLaborContractBatchV2Input = { finalizedAt: string; finalization: NonNullable<LaborV2ContractBatchIntent['finalization']> };
export type LaborV2OpenContractBatch = { id: string; title: string; startsOn: string; memberPersonIds: string[]; };
export type PostLaborV2PaymentSessionInput = {
  id?: string; paymentDate: string; method?: string; note?: string;
  settlements: Array<{ id?: string; obligationId: string; wageSatang: number; bonusSatang?: number; advanceRecoveries?: Array<{ id?: string; advanceId: string; amountSatang: number }> }>;
};
export type CorrectLaborV2PaymentSessionInput = { reason: string; method?: string; note?: string };
export type LaborV2ReadModel = {
  sourceVersion: 'v2';
  tasks: Array<{ id: string; workDate: string; title: string; assigneePersonIds: string[] }>;
  obligations: Array<LaborV2ObligationIntent & { paidSatang: number; remainingSatang: number; status: 'open' | 'settled' }>;
  payments: Array<{ id: string; paymentDate: string; method: string; cashPaidSatang: number; currentRevision: number }>;
  events: Array<{ id: string; entityType: string; entityId: string; action: string; reason: string | null; occurredAt: string }>;
};

/**
 * A payment draft selects payable obligations, never work tasks.  The row is
 * deliberately recipient-safe: group work stays one `ชุดรับเงิน` row and is
 * never attributed to an individual worker.
 */
export type LaborV2PaymentBatchDraftItem = {
  obligationId: string;
  sourceKind: LaborV2ObligationIntent['sourceKind'];
  sourceUnitId: string;
  recipientKind: LaborV2ObligationIntent['recipientKind'];
  personId: string | null;
  recipientLabel: 'คนทำงาน' | 'ชุดรับเงิน';
  title: string;
  effectiveDate: string;
  dueSatang: number;
  paidSatang: number;
  remainingSatang: number;
};
export type LaborV2PaymentBatchDraftInput = { personId?: string; selectedObligationIds?: string[] };
export type LaborV2PaymentBatchDraft = {
  sourceVersion: 'v2';
  contextPersonId: string | null;
  available: LaborV2PaymentBatchDraftItem[];
  selected: LaborV2PaymentBatchDraftItem[];
  unavailableSelectionIds: string[];
};
export type LaborV2MoneyHistoryEntry =
  | { kind: 'payment'; id: string; effectiveDate: string; cashPaidSatang: number; payment: LaborV2ReadModel['payments'][number] }
  | { kind: 'advance'; id: string; effectiveDate: string; amountSatang: number; personId: string; advance: LaborWorkerAdvance };
export type LaborV2MoneyHistory = {
  sourceVersion: 'v2';
  payments: LaborV2ReadModel['payments'];
  advances: LaborWorkerAdvance[];
  events: LaborV2ReadModel['events'];
  entries: LaborV2MoneyHistoryEntry[];
};

/** V2-only projections.  They deliberately cannot mix the legacy payable ledger. */
export type LaborV2CalendarDay = { workDate: string; taskCount: number; taskIds: string[] };
export type LaborV2PersonProjection = {
  sourceVersion: 'v2';
  personId: string;
  tasks: LaborV2ReadModel['tasks'];
  obligations: LaborV2ReadModel['obligations'];
  payments: LaborV2ReadModel['payments'];
  events: LaborV2ReadModel['events'];
};

/** Read-only V2 work projections.  Payment state is contextual: one task can
 * legitimately belong to more than one compensation context. */
export type LaborV2TaskWageContext = {
  sourceKind: 'daily' | 'hourly' | 'contract';
  sourceUnitId: string;
  recipientKind: 'person' | 'group';
  personId: string | null;
  state: 'open_unpriced' | 'unpaid' | 'partial' | 'paid';
  dueSatang: number | null;
  paidSatang: number;
  remainingSatang: number | null;
};
export type LaborV2TaskDetail = LaborV2ReadModel['tasks'][number] & { wageContexts: LaborV2TaskWageContext[] };
export type LaborV2CalendarMonth = { sourceVersion: 'v2'; month: string; days: Array<LaborV2CalendarDay & { isInMonth: true }> };
export type LaborV2WorkListFilters = { startDate?: string; endDate?: string; personId?: string; sourceKind?: LaborV2TaskWageContext['sourceKind']; wageState?: LaborV2TaskWageContext['state'] };
export type LaborV2WorkList = { sourceVersion: 'v2'; items: LaborV2TaskDetail[]; nextCursor: string | null };
export type LaborV2TodayProjection = { sourceVersion: 'v2'; date: string; tasks: LaborV2TaskDetail[]; unpaid: LaborV2ReadModel['obligations'] };
export type LaborV2PersonDetail = LaborV2PersonProjection & { advances: LaborWorkerAdvance[]; payments: Array<LaborV2ReadModel['payments'][number] & { settledObligationIds: string[] }>; events: LaborV2ReadModel['events']; };
export type LegacyLaborRead = { sourceVersion: 'v1'; sourceLabel: 'ประวัติเดิม (V1, อ่านอย่างเดียว)'; jobs: Array<{ id: string; workDate: string; title: string }> };

export type LaborContractProgress = {
  id: string;
  progressDate: string;
  note: string;
  createdAt: string;
};

export type LaborContract = {
  id: string;
  title: string;
  workDate: string;
  note: string;
  startsOn: string | null;
  deadlineOn: string | null;
  completedOn: string | null;
  status: 'in_progress' | 'awaiting_amount' | 'completed' | 'cancelled';
  totalSatang: number | null;
  isReconciled: boolean;
  participants: Array<{ personId: string; shareSatang: number | null; paidSatang: number; remainingSatang: number }>;
  progress: LaborContractProgress[];
};

export type LegacyLaborSource = {
  legacyLaborEntryId: string;
  personId: string;
  workDate: string;
  amountDueBaht: number;
  amountPaidBaht: number;
  remainingSatang: number;
  importedAt: string | null;
};

export type LegacyCarryForwardBalance = LaborPayable & {
  sourceLaborEntryId: string | null;
  sourceWorkDate: string | null;
  sourceDueSatang: number | null;
  isManual: boolean;
};

export type LaborMvpReadModel = {
  people: LaborPersonBalance[];
  payables: LaborPayable[];
  payments: LaborPayment[];
  /** Additive payment-session surface; legacy fixtures may omit it until Phase 4 UI adoption. */
  paymentSessions?: LaborPaymentSession[];
  timeline: LaborTimelineEvent[];
  contracts: LaborContract[];
  legacySources: LegacyLaborSource[];
  legacyBalances: LegacyCarryForwardBalance[];
  settlementGroups: LaborSettlementGroup[];
  workBasisSnapshots: LaborWorkBasisSnapshot[];
  advances: LaborWorkerAdvance[];
  advanceDeductions: LaborAdvanceDeduction[];
};

/**
 * A UI-safe ledger event. `effectiveDate` is the business date used by calendar
 * and history; `recordedAt` is audit context only and must never drive bucketing.
 */
export type LaborProjectionEventType =
  | 'work'
  | 'contract_start'
  | 'contract_progress'
  | 'contract_completion'
  | 'contract_deadline'
  | 'individual_payment'
  | 'payment_session'
  | 'group_receipt'
  | 'advance'
  | 'advance_recovery';

export type LaborPaymentState = 'paid' | 'partial' | 'unpaid' | 'not_applicable';

export type LaborProjectionEvent = {
  id: string;
  eventType: LaborProjectionEventType;
  effectiveDate: string;
  recordedAt: string;
  label: string;
  detail: string;
  jobId: string | null;
  jobIds: string[];
  personId: string | null;
  personIds: string[];
  settlementGroupId: string | null;
  settlementRoute: LaborSettlementRoute | null;
  paymentState: LaborPaymentState;
  /** Cash or recovery movement on this event. It is zero for work/contract markers. */
  amountSatang: number;
  /** Work/contract obligation shown as context, deliberately separate from cash. */
  dueSatang: number;
  remainingSatang: number;
};

export type LaborCalendarDaySummary = {
  date: string;
  events: LaborProjectionEvent[];
  workCount: number;
  workDueSatang: number;
  individualPaymentSatang: number;
  /** Additive cash total for modern multi-recipient sessions. */
  paymentSessionCashSatang?: number;
  groupReceiptSatang: number;
  advanceIssuedSatang: number;
  advanceRecoveredSatang: number;
  contractProgressCount: number;
  contractCompletionCount: number;
  contractDeadlineCount: number;
};

export type LaborCalendarRangeInput = {
  startDate: string;
  endDate: string;
  personId?: string;
  eventTypes?: LaborProjectionEventType[];
  paymentState?: LaborPaymentState;
  settlementRoute?: LaborSettlementRoute;
  keyword?: string;
};

export type LaborCalendarRange = {
  startDate: string;
  endDate: string;
  days: LaborCalendarDaySummary[];
};

export type LaborHistoryInput = LaborCalendarRangeInput & { limit?: number };

export type LaborHistory = {
  events: LaborProjectionEvent[];
  total: number;
};

export type LaborJobDetail = {
  id: string;
  title: string;
  kind: 'normal' | 'contract' | 'legacy_import';
  workDate: string;
  note: string;
  createdAt: string;
  settlementRoute: LaborSettlementRoute;
  paymentState: LaborPaymentState;
  dueSatang: number;
  cashPaidSatang: number;
  advanceRecoveredSatang: number;
  remainingSatang: number;
  participants: Array<{ personId: string; displayName: string; payType: LaborPayType }>;
  settlementGroup: LaborSettlementGroup | null;
  contract: LaborContract | null;
  workBasisSnapshots: LaborWorkBasisSnapshot[];
  events: LaborProjectionEvent[];
};

export type LaborPersonDetail = {
  person: LaborPersonBalance;
  wagePayables: LaborPayable[];
  advances: LaborWorkerAdvance[];
  advanceDeductions: LaborAdvanceDeduction[];
  events: LaborProjectionEvent[];
};

export type LaborTodaySummary = {
  date: string;
  day: LaborCalendarDaySummary;
  unpaidPeople: LaborPersonBalance[];
  advanceAttentionPeople: LaborPersonBalance[];
};

/** Precomputed from real repository queries for the web-only SQLite-less preview. */
export type LaborPreviewWebProjections = {
  today: LaborTodaySummary;
  calendar: LaborCalendarRange;
  history: LaborHistory;
  jobs: Record<string, LaborJobDetail | null>;
  people: Record<string, LaborPersonDetail | null>;
};
