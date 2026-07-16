import type { ActivityCategory, EntityId, Material, PayType } from '../../domain';

export type TakaiView = 'today' | 'plot' | 'activity' | 'designLab';

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
  defaultPlotId: EntityId;
  defaultHoleId: EntityId | null;
  defaultWorkerId: EntityId | null;
  defaultSelfId: EntityId | null;
};

export type ActivityMaterialInput = {
  materialId: EntityId;
  amount: number;
  unit: string;
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
  performedAt: string;
  note: string;
  followUpOn?: string | null;
  targetType: 'plot' | 'hole';
  targetId: EntityId;
  materials: ActivityMaterialInput[];
  participants: ActivityParticipantInput[];
};

export type CreatedActivityResult = {
  activityId: EntityId;
  cropCycleId: EntityId | null;
  laborEntryIds: EntityId[];
};
