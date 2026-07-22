import type { Material } from '../../domain';
import { DEMO_NOW, formatThaiShortDate, nextDateFrom } from './date';
import type {
  ActivityCaptureOption,
  CaseListItem,
  CaseTimeline,
  CreatedActivityResult,
  HoleDetail,
  LaborLedger,
  MenuDashboard,
  MaterialLibraryItem,
  CreateActivityInput,
  TakaiView,
  TodayDashboard,
} from './types';

export * from './date';
export type * from './types';

type WebPreviewDb = {
  closedCase: boolean;
  demoSprayCount: number;
};

const categories: ActivityCaptureOption['categories'] = [
  { id: 'cat-spray', name: 'พ่นยา', kind: 'spray', trackByDefault: true, sortOrder: 1 },
  { id: 'cat-fertilizer', name: 'ใส่ปุ๋ย', kind: 'fertilizer', trackByDefault: true, sortOrder: 2 },
  { id: 'cat-prune', name: 'แต่งกิ่ง', kind: 'prune', trackByDefault: true, sortOrder: 3 },
];

const materials: Material[] = [
  {
    id: 'mat-fungicide-a',
    name: 'ยา A',
    type: 'fungicide',
    unit: 'cc',
    defaultRatePerTank: '20 cc / น้ำ 20 L',
    photoUri: null,
    notes: 'RN Web preview material',
  },
  {
    id: 'mat-clean-water',
    name: 'น้ำสะอาด',
    type: 'other',
    unit: 'L',
    defaultRatePerTank: '20 L',
    photoUri: null,
    notes: 'RN Web preview material',
  },
];

const people: ActivityCaptureOption['people'] = [
  { id: 'person-self', displayName: 'เจ้าของสวน', role: 'owner', isSelf: true },
  { id: 'person-worker', displayName: 'สมชาย', role: 'worker', isSelf: false },
];

const buildCaseTimeline = (sprayCount: number, closed = false): CaseTimeline => ({
  id: 'case-a-014',
  title: 'A-014 เชื้อราโคนต้น',
  targetLabel: 'A-014 · แปลง A',
  status: closed ? 'closed' : 'tracking',
  openedAt: '2026-07-10T08:00:00.000Z',
  closedAt: closed ? DEMO_NOW : null,
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
            performedAt: DEMO_NOW,
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
            latestWorkDate: DEMO_NOW,
          },
        ]
      : [],
  recentPaid: [],
});

const buildMaterials = (sprayCount: number): MaterialLibraryItem[] =>
  materials.map((material) => ({
    id: material.id,
    name: material.name,
    type: material.type,
    unit: material.unit,
    defaultRatePerTank: material.defaultRatePerTank ?? null,
    photoUri: material.photoUri ?? null,
    lastUsedAt: sprayCount > 0 && material.id === 'mat-fungicide-a' ? DEMO_NOW : null,
    usageCount: sprayCount > 0 && material.id === 'mat-fungicide-a' ? 1 : 0,
  }));

const buildCaseList = (sprayCount: number, closedCase: boolean, statusFilter?: CaseListItem['status']): CaseListItem[] => {
  const caseItem: CaseListItem = {
    id: 'case-a-014',
    title: 'A-014 เชื้อราโคนต้น',
    targetLabel: 'A-014 · แปลง A',
    status: closedCase ? 'closed' : 'tracking',
    statusLabel: closedCase ? 'ปิดเคส' : 'ติดตามอยู่',
    openedAt: '2026-07-10T08:00:00.000Z',
    closedAt: closedCase ? DEMO_NOW : null,
    latestActivityAt: sprayCount > 0 ? DEMO_NOW : null,
    entryCount: sprayCount,
  };

  return !statusFilter || caseItem.status === statusFilter ? [caseItem] : [];
};

const buildMenuDashboard = (sprayCount: number, closedCase: boolean): MenuDashboard => ({
  gardenName: 'สวนตาไก๊',
  activeCaseCount: closedCase ? 0 : 1,
  closedCaseCount: closedCase ? 1 : 0,
  unpaidLaborTotal: sprayCount > 0 ? 600 : 0,
  materialCount: materials.length,
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
  plantedOn: '2024-10-10',
  ageDays: 645,
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
            trailing: formatThaiShortDate(DEMO_NOW),
            variant: 'activity',
          },
        ]
      : [],
});

const buildDashboard = (sprayCount: number, closedCase = false): TodayDashboard => ({
  gardenName: 'สวนตาไก๊',
  unpaidLaborTotal: sprayCount > 0 ? 600 : 0,
  plot: {
    id: 'plot-a',
    name: 'แปลง A',
    areaRai: 6.2,
    activeCrop: {
      id: 'crop-2026',
      label: 'Crop 2026',
      startsOn: '2026-01-01',
      activeDays: 197,
    },
    totalHoles: 300,
    plantedHoles: 278,
    emptyHoles: 22,
    trackers: [
      {
        categoryId: 'cat-spray',
        title: 'พ่นยา',
        count: sprayCount,
        latestPerformedAt: sprayCount > 0 ? DEMO_NOW : null,
        elapsedDays: sprayCount > 0 ? 0 : null,
        nextDueOn: sprayCount > 0 ? nextDateFrom(DEMO_NOW, 4) : null,
        progress: sprayCount > 0 ? 0.2 : 0,
      },
      {
        categoryId: 'cat-fertilizer',
        title: 'ใส่ปุ๋ย',
        count: 3,
        latestPerformedAt: '2026-07-10T08:30:00.000Z',
        elapsedDays: 6,
        nextDueOn: '2026-07-25',
        progress: 0.86,
      },
      {
        categoryId: 'cat-prune',
        title: 'แต่งกิ่ง',
        count: 2,
        latestPerformedAt: '2026-07-03T08:30:00.000Z',
        elapsedDays: 13,
        nextDueOn: '2026-07-28',
        progress: 1,
      },
    ],
    activeCases: closedCase
      ? []
      : [
          {
            id: 'case-a-014',
            title: 'เชื้อราที่โคนต้น',
            statusLabel: 'ติดตามอยู่',
            targetLabel: 'หลุม A-014',
          },
        ],
  },
  recentItems: sprayCount > 0
    ? [
        {
          id: 'activity-web-preview-spray',
          title: 'พ่นยา แปลง A',
          meta: 'พ่นยาเชื้อราที่โคนต้นและรอบทรงพุ่ม · ยา A, น้ำสะอาด',
          trailing: formatThaiShortDate(nextDateFrom(DEMO_NOW, 4)),
          variant: 'activity',
        },
      ]
    : [
        {
          id: 'empty-today',
          title: 'ยังไม่มีบันทึกวันนี้',
          meta: 'RN Web preview ใช้ข้อมูลจำลอง ไม่แตะ SQLite',
          trailing: 'เริ่ม',
          variant: 'activity',
        },
      ],
});

export const getActivityCaptureOptions = async (): Promise<ActivityCaptureOption> => ({
  categories,
  materials,
  people,
  defaultPlotId: 'plot-a',
  defaultHoleId: 'hole-a-014',
  defaultWorkerId: 'person-worker',
  defaultSelfId: 'person-self',
});

export const getTodayDashboard = async (db: WebPreviewDb): Promise<TodayDashboard> => {
  return buildDashboard(db.demoSprayCount, db.closedCase);
};

export const createDemoSprayActivity = async (db: WebPreviewDb): Promise<CreatedActivityResult> => {
  db.demoSprayCount += 1;
  return {
    activityId: 'activity-web-preview-spray',
    cropCycleId: 'crop-2026',
    laborEntryIds: ['labor-web-preview'],
  };
};

export const createFieldActivity = async (
  db: WebPreviewDb,
  _input: Omit<CreateActivityInput, 'id'> & { idSeed: string },
): Promise<CreatedActivityResult> => {
  db.demoSprayCount += 1;
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
  buildMenuDashboard(db.demoSprayCount, db.closedCase);

export const getCaseTimeline = async (db: WebPreviewDb, _caseId = 'case-a-014'): Promise<CaseTimeline> =>
  buildCaseTimeline(db.demoSprayCount, db.closedCase);

export const closeCase = async (db: WebPreviewDb): Promise<void> => {
  db.closedCase = true;
};

export const getLaborLedger = async (db: WebPreviewDb): Promise<LaborLedger> => buildLaborLedger(db.demoSprayCount);

export const settleUnpaidLaborForPerson = async (db: WebPreviewDb): Promise<void> => {
  db.demoSprayCount = 0;
};

export const getMaterialLibrary = async (db: WebPreviewDb): Promise<MaterialLibraryItem[]> => buildMaterials(db.demoSprayCount);

export const getHoleDetail = async (db: WebPreviewDb): Promise<HoleDetail> => buildHoleDetail(db.demoSprayCount, db.closedCase);

export type { TakaiView };
