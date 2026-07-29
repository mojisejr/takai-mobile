import type { ActivityCategory, Material } from '../../domain';
import { formatThaiShortDate } from './date';
import { followUpDueState, formatFollowUpDueLabel } from './followUp';
import type {
  ActivityCaptureOption,
  CategoryInput,
  CaseListItem,
  CaseTimeline,
  CreatedActivityResult,
  HoleDetail,
  LaborLedger,
  MenuDashboard,
  MaterialInput,
  MaterialLibraryItem,
  PlotInput,
  PlotDetail,
  PlotSummary,
  HoleInput,
  PlantingInput,
  RetirePlantingInput,
  SetupPlot,
  PersonDirectoryItem,
  PersonInput,
  CreateActivityInput,
  TakaiView,
  TodayDashboard,
  TodayScope,
} from './types';

export * from './date';
export * from './chemical';
export * from './followUp';
export * from './followUpNotifications';
export * from './activityValidation';
export * from './materialCatalogFlow';
export type * from './types';

// React Native Web resolves this barrel at runtime; keep shared-screen helpers explicit here.
export { calculateChemicalDose } from './chemical';
export { validateActivityDraft } from './activityValidation';
export { filterMaterialLibraryItems } from './materialCatalogFlow';

const WEB_PREVIEW_NOW = '2026-07-16T08:30:00.000Z';

type WebPreviewDb = {
  closedCase: boolean;
  demoSprayCount: number;
  recordedFollowUpOn: string | null;
  categories: Array<ActivityCategory & { archivedAt: string | null }>;
  people: PersonDirectoryItem[];
  materials: Material[];
  trackedCategoryIds: string[];
  plots: Array<{ id: string; gardenId: string; name: string; areaRai: number; sortOrder: number }>;
  holes: Array<{ id: string; plotId: string; marker: string; status: 'empty' | 'planted'; plantName: string | null; variety: string | null; plantedOn: string | null }>;
};

const buildCaseTimeline = (sprayCount: number, closed = false): CaseTimeline => ({
  id: 'case-a-014',
  title: 'A-014 เชื้อราโคนต้น',
  targetLabel: 'A-014 · แปลง A',
  status: closed ? 'closed' : 'tracking',
  openedAt: '2026-07-10T08:00:00.000Z',
  closedAt: closed ? WEB_PREVIEW_NOW : null,
  entries: [
    {
      id: 'case-a-014-opened',
      title: 'เปิดเคส',
      meta: 'พบเชื้อราที่โคนต้น',
      performedAt: '2026-07-10T08:00:00.000Z',
      dayLabel: 'Day 0',
      thumbnailUri: null,
    },
    ...(sprayCount > 0
      ? [
          {
            id: 'activity-web-preview-spray',
            title: 'พ่นยา',
            meta: 'พ่นยาเชื้อราที่โคนต้นและรอบทรงพุ่ม',
            performedAt: WEB_PREVIEW_NOW,
            dayLabel: 'Day 6',
            thumbnailUri: null,
          },
        ]
      : []),
  ],
});

const buildLaborLedger = (sprayCount: number): LaborLedger => ({
  unpaidTotal: sprayCount > 0 ? 600 : 0,
  unpaidPeople:
    sprayCount > 0
      ? [
          {
            personId: 'person-worker',
            displayName: 'สมชาย',
            unpaidTotal: 600,
            unpaidCount: 1,
            sourceCount: 1,
            latestWorkDate: WEB_PREVIEW_NOW,
          },
        ]
      : [],
  recentPaid: [],
});

const buildMaterials = (db: WebPreviewDb, includeArchived = true): MaterialLibraryItem[] =>
  db.materials.filter((material) => includeArchived || !material.archivedAt).map((material) => ({
    id: material.id,
    name: material.name,
    type: material.type,
    unit: material.unit,
    defaultRatePerTank: material.defaultRatePerTank ?? null,
    photoUri: material.photoUri ?? null,
    notes: material.notes ?? null,
    lastUsedAt: db.demoSprayCount > 0 && material.id === 'mat-fungicide-a' ? WEB_PREVIEW_NOW : null,
    usageCount: db.demoSprayCount > 0 && material.id === 'mat-fungicide-a' ? 1 : 0,
    archivedAt: material.archivedAt,
    commonName: material.commonName ?? null,
    brandName: material.brandName ?? null,
    chemicalGroup: material.chemicalGroup ?? null,
    usageLabel: material.usageLabel ?? null,
    referenceAmount: material.referenceAmount ?? null,
    referenceUnit: material.referenceUnit ?? null,
    referenceWaterLitres: material.referenceWaterLitres ?? null,
  }));

const buildCaseList = (sprayCount: number, closedCase: boolean, statusFilter?: CaseListItem['status']): CaseListItem[] => {
  const caseItem: CaseListItem = {
    id: 'case-a-014',
    title: 'A-014 เชื้อราโคนต้น',
    targetLabel: 'A-014 · แปลง A',
    status: closedCase ? 'closed' : 'tracking',
    statusLabel: closedCase ? 'ปิดเคส' : 'ติดตามอยู่',
    openedAt: '2026-07-10T08:00:00.000Z',
    closedAt: closedCase ? WEB_PREVIEW_NOW : null,
    latestActivityAt: sprayCount > 0 ? WEB_PREVIEW_NOW : null,
    entryCount: sprayCount,
  };

  return !statusFilter || caseItem.status === statusFilter ? [caseItem] : [];
};

const buildMenuDashboard = (sprayCount: number, closedCase: boolean, materialCount: number): MenuDashboard => ({
  gardenName: 'สวนตาไก๊',
  activeCaseCount: closedCase ? 0 : 1,
  closedCaseCount: closedCase ? 1 : 0,
  unpaidLaborTotal: sprayCount > 0 ? 600 : 0,
  materialCount,
  plotCount: 1,
  holeCount: 300,
  localStatusLabel: 'ออฟไลน์ 100%',
});

const buildHoleDetail = (sprayCount: number, closedCase = false): HoleDetail => ({
  id: 'hole-a-014',
  marker: 'A-014',
  status: 'planted',
  plotName: 'แปลง A',
  plantName: 'ทุเรียนหมอนทอง',
  variety: 'หมอนทอง',
  plantedOn: '2024-10-10',
  ageDays: 645,
  lifecycle: [{
    id: 'planting-web-hole-a-014',
    plantName: 'ทุเรียนหมอนทอง',
    variety: 'หมอนทอง',
    plantedOn: '2024-10-10',
    removedOn: null,
    removedReason: null,
    status: 'active',
  }],
  activeCases: closedCase
    ? []
    : [
        {
          id: 'case-a-014',
          title: 'A-014 เชื้อราโคนต้น',
          statusLabel: 'ติดตามอยู่',
          targetLabel: 'A-014',
        },
      ],
  activities:
    sprayCount > 0
      ? [
          {
            id: 'activity-web-preview-spray',
            title: 'พ่นยา',
            meta: 'พ่นยาเชื้อราที่โคนต้นและรอบทรงพุ่ม · ยา A',
            trailing: formatThaiShortDate(WEB_PREVIEW_NOW),
            variant: 'activity',
          },
        ]
      : [],
});

const buildPlotDashboard = (db: WebPreviewDb, plotId: string) => {
  const source = db.plots.find((plot) => plot.id === plotId) ?? db.plots[0];
  const isPrimary = source.id === 'plot-a';
  const holes = db.holes.filter((hole) => hole.plotId === source.id);
  return {
    id: source.id,
    name: source.name,
    areaRai: source.areaRai,
    activeCrop: isPrimary ? {
      id: 'plot-a',
      label: 'Crop 2026',
      startsOn: '2026-01-01',
      activeDays: 197,
    } : null,
    totalHoles: holes.length,
    plantedHoles: holes.filter((hole) => hole.status === 'planted').length,
    emptyHoles: holes.filter((hole) => hole.status === 'empty').length,
    trackers: isPrimary ? [
      {
        categoryId: 'cat-spray',
        title: 'พ่นยา',
        count: db.demoSprayCount,
        latestPerformedAt: db.demoSprayCount > 0 ? WEB_PREVIEW_NOW : null,
        elapsedDays: db.demoSprayCount > 0 ? 0 : null,
        nextDueOn: db.demoSprayCount > 0 ? db.recordedFollowUpOn : null,
        dueState: followUpDueState(db.demoSprayCount > 0 ? db.recordedFollowUpOn : null),
        progress: db.demoSprayCount > 0 ? 0.2 : 0,
      },
      {
        categoryId: 'cat-fertilizer',
        title: 'ใส่ปุ๋ย',
        count: 3,
        latestPerformedAt: '2026-07-10T08:30:00.000Z',
        elapsedDays: 6,
        nextDueOn: '2026-07-25',
        dueState: followUpDueState('2026-07-25'),
        progress: 0.86,
      },
      {
        categoryId: 'cat-prune',
        title: 'แต่งกิ่ง',
        count: 2,
        latestPerformedAt: '2026-07-03T08:30:00.000Z',
        elapsedDays: 13,
        nextDueOn: '2026-07-28',
        dueState: followUpDueState('2026-07-28'),
        progress: 1,
      },
    ].filter((tracker) => db.trackedCategoryIds.includes(tracker.categoryId)) : [],
    activeCases: isPrimary && !db.closedCase ? [{
      id: 'case-a-014',
      title: 'เชื้อราที่โคนต้น',
      statusLabel: 'ติดตามอยู่',
      targetLabel: 'หลุม A-014',
    }] : [],
  };
};

const buildDashboard = (db: WebPreviewDb, scope: TodayScope = 'all'): TodayDashboard => {
  const plots = db.plots.filter((plot) => scope === 'all' || plot.id === scope).map((plot) => buildPlotDashboard(db, plot.id));
  const plot = plots[0] ?? buildPlotDashboard(db, db.plots[0]?.id ?? 'plot-a');
  return {
  gardenName: 'สวนตาไก๊',
  scope,
  plots,
  unpaidLaborTotal: db.demoSprayCount > 0 ? 600 : 0,
  plot,

  recentItems: db.demoSprayCount > 0
    ? [
        {
          id: 'activity-web-preview-spray',
          title: `พ่นยา ${db.plots.find((item) => item.id === 'plot-a')?.name ?? 'แปลง A'}`,
          meta: 'พ่นยาเชื้อราที่โคนต้นและรอบทรงพุ่ม · ยา A, น้ำสะอาด',
          trailing: formatFollowUpDueLabel(db.recordedFollowUpOn) ?? formatThaiShortDate(WEB_PREVIEW_NOW),
          variant: 'activity' as const,
        },
      ].filter(() => scope === 'all' || scope === 'plot-a')
    : [
        {
          id: 'empty-today',
          title: 'ยังไม่มีบันทึกวันนี้',
          meta: 'RN Web preview ใช้ข้อมูลจำลอง ไม่แตะ SQLite',
          trailing: 'เริ่ม',
          variant: 'activity' as const,
        },
      ],
};
};

export const getActivityCaptureOptions = async (db: WebPreviewDb): Promise<ActivityCaptureOption> => ({
  categories: db.categories.filter((category) => !category.archivedAt),
  materials: db.materials.filter((material) => !material.archivedAt),
  plots: db.plots.map(({ id, name }) => ({ id, name })),
  holes: db.holes.map(({ id, plotId, marker, status }) => ({ id, plotId, marker, status })),
  activeCases: [{ id: 'case-a-014', plotId: 'plot-a', holeId: 'hole-a-014', title: 'A-014 เชื้อราโคนต้น' }],
  people: db.people.filter((person) => !person.archivedAt).map(({ specialty: _specialty, phone: _phone, note: _note, archivedAt: _archivedAt, ...person }) => person),
  defaultPlotId: db.plots[0]?.id ?? 'plot-a',
  defaultHoleId: db.holes[0]?.id ?? null,
  defaultWorkerId: db.people.find((person) => !person.isSelf && !person.archivedAt)?.id ?? null,
  defaultSelfId: db.people.find((person) => person.isSelf && !person.archivedAt)?.id ?? null,
  defaultPerformedAt: WEB_PREVIEW_NOW,
});

export const listSetupPlots = async (db: WebPreviewDb): Promise<SetupPlot[]> => db.plots.map((plot) => ({ ...plot }));

export const createPlot = async (db: WebPreviewDb, input: PlotInput): Promise<string> => {
  const name = input.name.trim();
  if (!name) throw new Error('TAKAI requires a plot name');
  const id = `plot-web-${db.plots.length + 1}`;
  db.plots.push({ id, gardenId: input.gardenId ?? 'garden-web', name, areaRai: Number(input.areaRai ?? 0), sortOrder: input.sortOrder ?? db.plots.length });
  return id;
};

export const createHole = async (db: WebPreviewDb, input: HoleInput): Promise<string> => {
  const marker = input.marker.trim();
  if (!marker) throw new Error('TAKAI requires a hole marker');
  const id = `hole-web-${db.holes.length + 1}`;
  db.holes.push({ id, plotId: input.plotId, marker, status: 'empty', plantName: null, variety: null, plantedOn: null });
  return id;
};

export const createPlanting = async (db: WebPreviewDb, input: PlantingInput): Promise<string> => {
  const hole = db.holes.find((item) => item.id === input.holeId && item.status === 'empty');
  if (!hole) throw new Error('TAKAI hole is unavailable for planting');
  if (!input.plantName.trim()) throw new Error('TAKAI requires a plant name');
  hole.status = 'planted';
  hole.plantName = input.plantName.trim();
  hole.variety = input.variety?.trim() || null;
  hole.plantedOn = input.plantedOn;
  return `planting-web-${input.holeId}`;
};

export const retireCurrentPlanting = async (db: WebPreviewDb, input: RetirePlantingInput): Promise<string> => {
  const hole = db.holes.find((item) => item.id === input.holeId && item.status === 'planted');
  if (!hole) throw new Error('TAKAI hole has no current planting to retire');
  hole.status = 'empty';
  hole.plantName = null;
  hole.variety = null;
  hole.plantedOn = null;
  return `planting-web-${input.holeId}`;
};

export const listActivityCategories = async (db: WebPreviewDb, includeArchived = false): Promise<ActivityCategory[]> =>
  db.categories.filter((category) => includeArchived || !category.archivedAt);

export const createActivityCategory = async (db: WebPreviewDb, input: CategoryInput): Promise<string> => {
  const id = input.id ?? `category-web-${db.categories.length + 1}`;
  db.categories.push({
    id,
    name: input.name.trim(),
    kind: input.kind,
    trackByDefault: false,
    sortOrder: input.sortOrder ?? db.categories.length + 1,
    archivedAt: null,
  });
  return id;
};

export const updateActivityCategory = async (db: WebPreviewDb, categoryId: string, input: CategoryInput): Promise<void> => {
  const category = db.categories.find((item) => item.id === categoryId);
  if (category) Object.assign(category, { name: input.name.trim(), kind: input.kind, sortOrder: input.sortOrder ?? category.sortOrder });
};

export const archiveActivityCategory = async (db: WebPreviewDb, categoryId: string): Promise<void> => {
  const category = db.categories.find((item) => item.id === categoryId);
  if (category) category.archivedAt = WEB_PREVIEW_NOW;
};

export const restoreActivityCategory = async (db: WebPreviewDb, categoryId: string): Promise<void> => {
  const category = db.categories.find((item) => item.id === categoryId);
  if (category) category.archivedAt = null;
};

export const listPeople = async (db: WebPreviewDb, includeArchived = false): Promise<PersonDirectoryItem[]> =>
  db.people.filter((person) => includeArchived || !person.archivedAt);

export const createPerson = async (db: WebPreviewDb, input: PersonInput): Promise<string> => {
  const id = input.id ?? `person-web-${db.people.length + 1}`;
  db.people.push({
    id,
    displayName: input.displayName.trim(),
    role: input.role ?? 'worker',
    isSelf: input.isSelf ?? false,
    specialty: input.specialty?.trim() ?? '',
    phone: input.phone?.trim() ?? '',
    note: input.note?.trim() ?? '',
    archivedAt: null,
  });
  return id;
};

export const updatePerson = async (db: WebPreviewDb, personId: string, input: PersonInput): Promise<void> => {
  const person = db.people.find((item) => item.id === personId);
  if (person) Object.assign(person, { ...input, displayName: input.displayName.trim(), role: input.role ?? 'worker', isSelf: input.isSelf ?? false });
};

export const archivePerson = async (db: WebPreviewDb, personId: string): Promise<void> => {
  const person = db.people.find((item) => item.id === personId);
  if (person) person.archivedAt = WEB_PREVIEW_NOW;
};

export const restorePerson = async (db: WebPreviewDb, personId: string): Promise<void> => {
  const person = db.people.find((item) => item.id === personId);
  if (person) person.archivedAt = null;
};

export const listMaterials = async (db: WebPreviewDb, includeArchived = false): Promise<MaterialLibraryItem[]> =>
  buildMaterials(db, includeArchived);

export const createMaterial = async (db: WebPreviewDb, input: MaterialInput): Promise<string> => {
  const id = input.id ?? `material-web-${db.materials.length + 1}`;
  const name = input.name.trim();
  const unit = input.unit.trim();
  if (!name) throw new Error('TAKAI requires a material name');
  if (!unit) throw new Error('TAKAI requires a material unit');
  db.materials.push({
    id,
    name,
    type: input.type,
    unit,
    defaultRatePerTank: input.defaultRatePerTank?.trim() || null,
    photoUri: null,
    notes: input.notes?.trim() || null,
    createdAt: WEB_PREVIEW_NOW,
    archivedAt: null,
    commonName: input.commonName?.trim() || null,
    brandName: input.brandName?.trim() || null,
    chemicalGroup: input.chemicalGroup?.trim() || null,
    usageLabel: input.usageLabel?.trim() || null,
    referenceAmount: input.referenceAmount ?? null,
    referenceUnit: input.referenceUnit?.trim() || null,
    referenceWaterLitres: input.referenceWaterLitres ?? null,
  });
  return id;
};

export const updateMaterial = async (db: WebPreviewDb, materialId: string, input: MaterialInput): Promise<void> => {
  const material = db.materials.find((item) => item.id === materialId);
  if (!material) return;
  const name = input.name.trim();
  const unit = input.unit.trim();
  if (!name) throw new Error('TAKAI requires a material name');
  if (!unit) throw new Error('TAKAI requires a material unit');
  Object.assign(material, {
    name,
    type: input.type,
    unit,
    defaultRatePerTank: input.defaultRatePerTank?.trim() || null,
    notes: input.notes?.trim() || null,
    commonName: input.commonName?.trim() || null,
    brandName: input.brandName?.trim() || null,
    chemicalGroup: input.chemicalGroup?.trim() || null,
    usageLabel: input.usageLabel?.trim() || null,
    referenceAmount: input.referenceAmount ?? null,
    referenceUnit: input.referenceUnit?.trim() || null,
    referenceWaterLitres: input.referenceWaterLitres ?? null,
  });
};

export const archiveMaterial = async (db: WebPreviewDb, materialId: string): Promise<void> => {
  const material = db.materials.find((item) => item.id === materialId);
  if (material) material.archivedAt = WEB_PREVIEW_NOW;
};

export const restoreMaterial = async (db: WebPreviewDb, materialId: string): Promise<void> => {
  const material = db.materials.find((item) => item.id === materialId);
  if (material) material.archivedAt = null;
};

export const pinPlotTracker = async (db: WebPreviewDb, _plotId: string, categoryId: string): Promise<void> => {
  if (!db.trackedCategoryIds.includes(categoryId)) db.trackedCategoryIds.push(categoryId);
};

export const unpinPlotTracker = async (db: WebPreviewDb, _plotId: string, categoryId: string): Promise<void> => {
  db.trackedCategoryIds = db.trackedCategoryIds.filter((id) => id !== categoryId);
};

export const listPlotSummaries = async (db: WebPreviewDb): Promise<PlotSummary[]> =>
  (await Promise.all(db.plots.map((plot) => buildPlotDashboard(db, plot.id)))).map((plot) => ({
    id: plot.id, name: plot.name, areaRai: plot.areaRai, totalHoles: plot.totalHoles,
    plantedHoles: plot.plantedHoles, emptyHoles: plot.emptyHoles,
    dueTrackerCount: plot.trackers.filter((tracker) => tracker.dueState === 'overdue' || tracker.dueState === 'due_today').length,
    activeCaseCount: plot.activeCases.length,
  }));

export const getPlotDetail = async (db: WebPreviewDb, plotId: string): Promise<PlotDetail> => ({
  plot: buildPlotDashboard(db, plotId),
  holes: db.holes.filter((hole) => hole.plotId === plotId).map(({ id, marker, status }) => ({ id, marker, status })),
  recentItems: (await getTodayDashboard(db, plotId)).recentItems,
});

export const getTodayDashboard = async (db: WebPreviewDb, scope: TodayScope = 'all'): Promise<TodayDashboard> => buildDashboard(db, scope);

export const createDemoSprayActivity = async (db: WebPreviewDb): Promise<CreatedActivityResult> => {
  db.demoSprayCount += 1;
  db.recordedFollowUpOn = null;
  return {
    activityId: 'activity-web-preview-spray',
    cropCycleId: 'crop-2026',
    laborEntryIds: ['labor-web-preview'],
  };
};

export const createFieldActivity = async (
  db: WebPreviewDb,
  input: Omit<CreateActivityInput, 'id'> & { idSeed: string },
): Promise<CreatedActivityResult> => {
  db.demoSprayCount += 1;
  db.recordedFollowUpOn = input.followUpOn ?? null;
  return {
    activityId: 'activity-web-preview-field',
    cropCycleId: 'crop-2026',
    laborEntryIds: ['labor-web-preview'],
  };
};

export const getCaseList = async (
  db: WebPreviewDb,
  statusFilter?: CaseListItem['status'],
): Promise<CaseListItem[]> => buildCaseList(db.demoSprayCount, db.closedCase, statusFilter);

export const getMenuDashboard = async (db: WebPreviewDb): Promise<MenuDashboard> =>
  buildMenuDashboard(db.demoSprayCount, db.closedCase, db.materials.length);

export const getCaseTimeline = async (db: WebPreviewDb, _caseId = 'case-a-014'): Promise<CaseTimeline> =>
  buildCaseTimeline(db.demoSprayCount, db.closedCase);

export const closeCase = async (db: WebPreviewDb): Promise<void> => {
  db.closedCase = true;
};

export const getLaborLedger = async (db: WebPreviewDb): Promise<LaborLedger> => buildLaborLedger(db.demoSprayCount);

export const settleUnpaidLaborForPerson = async (db: WebPreviewDb): Promise<void> => {
  db.demoSprayCount = 0;
};

export const getMaterialLibrary = async (db: WebPreviewDb): Promise<MaterialLibraryItem[]> => buildMaterials(db, true);

export const getHoleDetail = async (db: WebPreviewDb): Promise<HoleDetail> => buildHoleDetail(db.demoSprayCount, db.closedCase);

export type { TakaiView };
