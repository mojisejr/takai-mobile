import type { ActivityCategory, EntityId, ISODateTime, Material, MaterialType, PayType, PersonRole } from '../../domain';

export type TakaiView =
  | 'today'
  | 'plot'
  | 'activity'
  | 'cases'
  | 'labor'
  | 'materials'
  | 'hole'
  | 'menu'
  | 'categories'
  | 'workers'
  | 'trackerManage'
  | 'designLab';

export type TrackerSummary = {
  categoryId: EntityId;
  title: string;
  count: number;
  latestPerformedAt: string | null;
  elapsedDays: number | null;
  nextDueOn: string | null;
  progress: number;
};

export type TodayActivityItem = {
  id: EntityId;
  title: string;
  meta: string;
  trailing: string;
  variant: 'activity' | 'case' | 'labor' | 'material' | 'hole';
};

export type ActiveCaseSummary = {
  id: EntityId;
  title: string;
  statusLabel: string;
  targetLabel: string;
};

export type PlotDashboard = {
  id: EntityId;
  name: string;
  areaRai: number;
  activeCrop: {
    id: EntityId;
    label: string;
    startsOn: string;
    activeDays: number;
  } | null;
  totalHoles: number;
  plantedHoles: number;
  emptyHoles: number;
  trackers: TrackerSummary[];
  activeCases: ActiveCaseSummary[];
};

export type TodayDashboard = {
  gardenName: string;
  plot: PlotDashboard;
  recentItems: TodayActivityItem[];
  unpaidLaborTotal: number;
};

export type ActivityCaptureOption = {
  categories: ActivityCategory[];
  materials: Material[];
  plots: Array<{
    id: EntityId;
    name: string;
  }>;
  holes: Array<{
    id: EntityId;
    plotId: EntityId;
    marker: string;
    status: 'empty' | 'planted';
  }>;
  activeCases: Array<{
    id: EntityId;
    plotId: EntityId;
    holeId: EntityId | null;
    title: string;
  }>;
  people: Array<{
    id: EntityId;
    displayName: string;
    role: 'owner' | 'worker';
    isSelf: boolean;
  }>;
  defaultPlotId: EntityId;
  defaultHoleId: EntityId | null;
  defaultWorkerId: EntityId | null;
  defaultSelfId: EntityId | null;
  defaultPerformedAt: ISODateTime;
};

export type CategoryInput = {
  id?: EntityId;
  name: string;
  kind: ActivityCategory['kind'];
  sortOrder?: number;
};

export type PersonDirectoryItem = {
  id: EntityId;
  displayName: string;
  role: PersonRole;
  isSelf: boolean;
  specialty: string;
  phone: string;
  note: string;
  archivedAt: string | null;
};

export type PersonInput = {
  id?: EntityId;
  displayName: string;
  role?: PersonRole;
  isSelf?: boolean;
  specialty?: string;
  phone?: string;
  note?: string;
};

export type MaterialInput = {
  id?: EntityId;
  name: string;
  type: MaterialType;
  unit: string;
  defaultRatePerTank?: string | null;
  notes?: string | null;
};

export type ActivityMaterialInput = {
  materialId: EntityId;
  amount: number;
  unit: string;
  waterVolume?: number | null;
  waterUnit?: string | null;
  dilutionText?: string | null;
  note?: string | null;
  sortOrder?: number;
};

export type ActivityParticipantInput = {
  personId: EntityId;
  payType: PayType;
  amountDue: number;
};

export type CreateActivityInput = {
  id?: EntityId;
  plotId: EntityId;
  categoryId: EntityId;
  performedAt: ISODateTime;
  note: string;
  followUpOn?: string | null;
  targetType: 'plot' | 'hole' | 'case';
  targetId: EntityId;
  materials: ActivityMaterialInput[];
  participants: ActivityParticipantInput[];
};

export type CreatedActivityResult = {
  activityId: EntityId;
  cropCycleId: EntityId | null;
  laborEntryIds: EntityId[];
};

export type CaseTimelineEntry = {
  id: EntityId;
  title: string;
  meta: string;
  performedAt: string;
  dayLabel: string;
  thumbnailUri: string | null;
};

export type CaseListItem = {
  id: EntityId;
  title: string;
  targetLabel: string;
  status: 'tracking' | 'closed' | 'archived';
  statusLabel: string;
  openedAt: string;
  closedAt: string | null;
  latestActivityAt: string | null;
  entryCount: number;
};

export type CaseTimeline = {
  id: EntityId;
  title: string;
  targetLabel: string;
  status: 'tracking' | 'closed' | 'archived';
  openedAt: string;
  closedAt: string | null;
  entries: CaseTimelineEntry[];
};

export type MenuDashboard = {
  gardenName: string;
  activeCaseCount: number;
  closedCaseCount: number;
  unpaidLaborTotal: number;
  materialCount: number;
  plotCount: number;
  holeCount: number;
  localStatusLabel: string;
};

export type LaborLedgerPerson = {
  personId: EntityId;
  displayName: string;
  unpaidTotal: number;
  unpaidCount: number;
  sourceCount: number;
  latestWorkDate: string | null;
};

export type LaborLedger = {
  unpaidTotal: number;
  unpaidPeople: LaborLedgerPerson[];
  recentPaid: Array<{
    id: EntityId;
    displayName: string;
    amountPaid: number;
    paidAt: string;
  }>;
};

export type MaterialLibraryItem = {
  id: EntityId;
  name: string;
  type: string;
  unit: string;
  defaultRatePerTank: string | null;
  photoUri: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  archivedAt: string | null;
};

export type HoleDetail = {
  id: EntityId;
  marker: string;
  status: string;
  plotName: string;
  plantName: string | null;
  plantedOn: string | null;
  ageDays: number | null;
  activities: TodayActivityItem[];
  activeCases: ActiveCaseSummary[];
};
