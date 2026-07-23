export type EntityId = string;
export type ISODate = string;
export type ISODateTime = string;

export type CropStatus = 'planned' | 'active' | 'closed';
export type HoleStatus = 'empty' | 'planted' | 'archived';
export type ActivityTargetType = 'plot' | 'hole' | 'case';
export type ActivityStatus = 'done' | 'planned' | 'cancelled';
export type CaseStatus = 'tracking' | 'closed' | 'archived';
export type PersonRole = 'owner' | 'worker';
export type PayType = 'none' | 'daily' | 'hourly' | 'piece' | 'contract';
export type LaborStatus = 'unpaid' | 'paid' | 'cancelled';
export type MaterialType = 'fungicide' | 'insecticide' | 'fertilizer' | 'soil' | 'tool' | 'other';

export interface Garden {
  id: EntityId;
  name: string;
  createdAt: ISODateTime;
  archivedAt?: ISODateTime | null;
}

export interface Plot {
  id: EntityId;
  gardenId: EntityId;
  name: string;
  areaRai: number;
  sortOrder: number;
}

export interface CropCycle {
  id: EntityId;
  plotId: EntityId;
  label: string;
  startsOn: ISODate;
  endsOn?: ISODate | null;
  status: CropStatus;
}

export interface Hole {
  id: EntityId;
  plotId: EntityId;
  marker: string;
  sortKey: string;
  status: HoleStatus;
}

export interface Planting {
  id: EntityId;
  holeId: EntityId;
  cropCycleId?: EntityId | null;
  plantName: string;
  plantedOn: ISODate;
  removedOn?: ISODate | null;
}

export interface ActivityCategory {
  id: EntityId;
  name: string;
  kind: 'spray' | 'fertilizer' | 'prune' | 'case' | 'labor' | 'note' | 'other';
  trackByDefault: boolean;
  sortOrder: number;
  archivedAt?: ISODateTime | null;
}

export interface PlotTracker {
  plotId: EntityId;
  categoryId: EntityId;
  createdAt: ISODateTime;
  archivedAt?: ISODateTime | null;
}

export interface Activity {
  id: EntityId;
  plotId: EntityId;
  cropCycleId?: EntityId | null;
  categoryId: EntityId;
  performedAt: ISODateTime;
  note: string;
  followUpOn?: ISODate | null;
  status: ActivityStatus;
}

export interface ActivityTarget {
  id: EntityId;
  activityId: EntityId;
  targetType: ActivityTargetType;
  targetId: EntityId;
}

export interface CaseRecord {
  id: EntityId;
  plotId: EntityId;
  holeId?: EntityId | null;
  title: string;
  status: CaseStatus;
  openedAt: ISODateTime;
  closedAt?: ISODateTime | null;
}

export interface Person {
  id: EntityId;
  displayName: string;
  role: PersonRole;
  isSelf: boolean;
  specialty?: string | null;
  phone?: string | null;
  note?: string | null;
  archivedAt?: ISODateTime | null;
}

export interface ActivityParticipant {
  id: EntityId;
  activityId: EntityId;
  personId: EntityId;
  payType: PayType;
  amountDue: number;
  contractJobId?: EntityId | null;
  paidAt?: ISODateTime | null;
}

export interface LaborEntry {
  id: EntityId;
  activityParticipantId: EntityId;
  personId: EntityId;
  workDate: ISODate;
  amountDue: number;
  amountPaid: number;
  status: LaborStatus;
}

export interface ContractJob {
  id: EntityId;
  title: string;
  plotId?: EntityId | null;
  agreedAmount: number;
  status: 'open' | 'settled' | 'cancelled';
  settledAt?: ISODateTime | null;
}

export interface Material {
  id: EntityId;
  name: string;
  type: MaterialType;
  unit: string;
  defaultRatePerTank?: string | null;
  photoUri?: string | null;
  notes?: string | null;
  createdAt: ISODateTime;
  archivedAt: ISODateTime | null;
}

export interface ActivityMaterial {
  id: EntityId;
  activityId: EntityId;
  materialId: EntityId;
  amount: number;
  unit: string;
  waterVolume?: number | null;
  waterUnit?: string | null;
  dilutionText?: string | null;
  note?: string | null;
  sortOrder: number;
}

export interface MediaAsset {
  id: EntityId;
  ownerType: 'activity' | 'case' | 'material' | 'hole' | 'plot';
  ownerId: EntityId;
  uri: string;
  caption?: string | null;
  createdAt: ISODateTime;
}
