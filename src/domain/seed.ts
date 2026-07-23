import type {
  ActivityCategory,
  CaseRecord,
  CropCycle,
  Garden,
  Hole,
  Material,
  Person,
  Planting,
  Plot,
  PlotTracker,
} from './types';

export const TAKAI_DEMO_SEED = {
  gardens: [
    {
      id: 'garden-main',
      name: 'สวนตาไก๊',
      createdAt: '2026-01-01T00:00:00.000Z',
      archivedAt: null,
    },
  ] satisfies Garden[],
  plots: [
    {
      id: 'plot-a',
      gardenId: 'garden-main',
      name: 'แปลง A',
      areaRai: 6.2,
      sortOrder: 1,
    },
  ] satisfies Plot[],
  cropCycles: [
    {
      id: 'crop-2026-plot-a',
      plotId: 'plot-a',
      label: 'Crop 2026',
      startsOn: '2026-01-01',
      endsOn: null,
      status: 'active',
    },
  ] satisfies CropCycle[],
  holes: [
    { id: 'hole-a-014', plotId: 'plot-a', marker: 'A-014', sortKey: 'A-014', status: 'planted' },
    { id: 'hole-a-065', plotId: 'plot-a', marker: 'A-065', sortKey: 'A-065', status: 'planted' },
    { id: 'hole-a-098', plotId: 'plot-a', marker: 'A-098', sortKey: 'A-098', status: 'planted' },
  ] satisfies Hole[],
  plantings: [
    {
      id: 'planting-a-014-durian',
      holeId: 'hole-a-014',
      cropCycleId: 'crop-2026-plot-a',
      plantName: 'ทุเรียนหมอนทอง',
      plantedOn: '2024-10-10',
      removedOn: null,
    },
  ] satisfies Planting[],
  activityCategories: [
    { id: 'cat-spray', name: 'พ่นยา', kind: 'spray', trackByDefault: true, sortOrder: 1, archivedAt: null },
    { id: 'cat-fertilizer', name: 'ใส่ปุ๋ย', kind: 'fertilizer', trackByDefault: true, sortOrder: 2, archivedAt: null },
    { id: 'cat-prune', name: 'แต่งกิ่ง', kind: 'prune', trackByDefault: true, sortOrder: 3, archivedAt: null },
    { id: 'cat-case', name: 'เคส/โรค', kind: 'case', trackByDefault: false, sortOrder: 4, archivedAt: null },
  ] satisfies ActivityCategory[],
  plotTrackers: [
    { plotId: 'plot-a', categoryId: 'cat-spray', createdAt: '2026-01-01T00:00:00.000Z', archivedAt: null },
    { plotId: 'plot-a', categoryId: 'cat-fertilizer', createdAt: '2026-01-01T00:00:00.000Z', archivedAt: null },
    { plotId: 'plot-a', categoryId: 'cat-prune', createdAt: '2026-01-01T00:00:00.000Z', archivedAt: null },
  ] satisfies PlotTracker[],
  cases: [
    {
      id: 'case-a-014',
      plotId: 'plot-a',
      holeId: 'hole-a-014',
      title: 'A-014 เชื้อราโคนต้น',
      status: 'tracking',
      openedAt: '2026-07-10T08:00:00.000Z',
      closedAt: null,
    },
  ] satisfies CaseRecord[],
  people: [
    {
      id: 'person-self',
      displayName: 'คุณนนท์',
      role: 'owner',
      isSelf: true,
      specialty: '',
      phone: '',
      note: '',
      archivedAt: null,
    },
    {
      id: 'person-worker-somchai',
      displayName: 'สมชาย',
      role: 'worker',
      isSelf: false,
      specialty: 'แต่งกิ่ง',
      phone: '',
      note: '',
      archivedAt: null,
    },
  ] satisfies Person[],
  materials: [
    {
      id: 'material-fungicide-a',
      name: 'ยา A (Fungicide)',
      type: 'fungicide',
      unit: 'cc',
      defaultRatePerTank: '20 cc / 20 L',
      photoUri: null,
      notes: 'ตัวอย่างวัสดุสำหรับทดสอบกิจกรรมพ่นยา',
      createdAt: '2026-07-01T00:00:00.000Z',
      archivedAt: null,
    },
    {
      id: 'material-spreader-a',
      name: 'สารจับใบ',
      type: 'other',
      unit: 'cc',
      defaultRatePerTank: '10 cc / 20 L',
      photoUri: null,
      notes: 'ตัวอย่างวัสดุเสริมสำหรับบันทึกพ่นยา',
      createdAt: '2026-07-01T00:00:00.000Z',
      archivedAt: null,
    },
  ] satisfies Material[],
};

export type TakaiDemoSeed = typeof TAKAI_DEMO_SEED;
