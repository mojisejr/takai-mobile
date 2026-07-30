export type LaborPayType = 'none' | 'daily' | 'hourly' | 'piece' | 'contract';

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
};

export type AddContractProgressInput = {
  id?: string;
  progressDate: string;
  note: string;
};

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
  remainingSatang: number;
  kind: 'normal' | 'contract' | 'legacy_import';
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
  dueSatang: number;
  paidSatang: number;
  remainingSatang: number;
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
};
