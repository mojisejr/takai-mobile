import type { Material } from '../../domain';
import { DEMO_NOW, formatThaiShortDate, nextDateFrom } from './date';
import type {
  ActivityCaptureOption,
  CreatedActivityResult,
  TakaiView,
  TodayDashboard,
} from './types';

export * from './date';
export type * from './types';

type WebPreviewDb = {
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

const buildDashboard = (sprayCount: number): TodayDashboard => ({
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
    activeCases: [
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
  defaultPlotId: 'plot-a',
  defaultHoleId: 'hole-a-001',
  defaultWorkerId: 'person-worker',
  defaultSelfId: 'person-self',
});

export const getTodayDashboard = async (db: WebPreviewDb): Promise<TodayDashboard> => {
  return buildDashboard(db.demoSprayCount);
};

export const createDemoSprayActivity = async (db: WebPreviewDb): Promise<CreatedActivityResult> => {
  db.demoSprayCount += 1;
  return {
    activityId: 'activity-web-preview-spray',
    cropCycleId: 'crop-2026',
    laborEntryIds: ['labor-web-preview'],
  };
};

export type { TakaiView };
