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

export type LaborMvpReadModel = {
  people: LaborPersonBalance[];
  payables: LaborPayable[];
  payments: LaborPayment[];
  timeline: LaborTimelineEvent[];
};
