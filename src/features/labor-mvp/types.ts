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
