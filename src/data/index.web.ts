import type { Material } from '../domain';

export type TakaiDatabase = {
  __platform: 'web-preview';
  closedCase: boolean;
  demoSprayCount: number;
  recordedFollowUpOn: string | null;
  categories: Array<{
    id: string;
    name: string;
    kind: 'spray' | 'fertilizer' | 'prune' | 'case' | 'labor' | 'note' | 'other';
    trackByDefault: boolean;
    sortOrder: number;
    archivedAt: string | null;
  }>;
  people: Array<{
    id: string;
    displayName: string;
    role: 'owner' | 'worker';
    isSelf: boolean;
    specialty: string;
    phone: string;
    note: string;
    archivedAt: string | null;
  }>;
  materials: Material[];
  trackedCategoryIds: string[];
  plots: Array<{ id: string; gardenId: string; name: string; areaRai: number; sortOrder: number }>;
  holes: Array<{ id: string; plotId: string; marker: string; status: 'empty' | 'planted'; plantName: string | null; variety: string | null; plantedOn: string | null }>;
};

export const initializeTakaiDatabase = async (): Promise<TakaiDatabase> => ({
  __platform: 'web-preview',
  closedCase: false,
  demoSprayCount: 0,
  recordedFollowUpOn: null,
  categories: [
    { id: 'cat-spray', name: 'พ่นยา', kind: 'spray', trackByDefault: true, sortOrder: 1, archivedAt: null },
    { id: 'cat-fertilizer', name: 'ใส่ปุ๋ย', kind: 'fertilizer', trackByDefault: true, sortOrder: 2, archivedAt: null },
    { id: 'cat-prune', name: 'แต่งกิ่ง', kind: 'prune', trackByDefault: true, sortOrder: 3, archivedAt: null },
  ],
  people: [
    { id: 'person-self', displayName: 'เจ้าของสวน', role: 'owner', isSelf: true, specialty: '', phone: '', note: '', archivedAt: null },
    { id: 'person-worker', displayName: 'สมชาย', role: 'worker', isSelf: false, specialty: 'พ่นยาและแต่งกิ่ง', phone: '081-234-5678', note: '', archivedAt: null },
  ],
  materials: [
    {
      id: 'mat-fungicide-a',
      name: 'ยา A',
      type: 'fungicide',
      unit: 'cc',
      defaultRatePerTank: '20 cc / น้ำ 20 L',
      photoUri: null,
      notes: 'RN Web preview material',
      createdAt: '2026-07-01T00:00:00.000Z',
      archivedAt: null,
      commonName: 'แมนโคเซบ',
      brandName: 'ยา A',
      chemicalGroup: null,
      usageLabel: 'พ่นป้องกันเชื้อรา',
      referenceAmount: 20,
      referenceUnit: 'cc',
      referenceWaterLitres: 200,
    },
    {
      id: 'mat-clean-water',
      name: 'น้ำสะอาด',
      type: 'other',
      unit: 'L',
      defaultRatePerTank: '20 L',
      photoUri: null,
      notes: 'RN Web preview material',
      createdAt: '2026-07-01T00:00:00.000Z',
      archivedAt: null,
    },
  ],
  trackedCategoryIds: ['cat-spray', 'cat-fertilizer', 'cat-prune'],
  plots: [
    { id: 'plot-a', gardenId: 'garden-web', name: 'แปลง A', areaRai: 6.2, sortOrder: 0 },
    { id: 'plot-b', gardenId: 'garden-web', name: 'แปลงหลังบ้าน', areaRai: 1.5, sortOrder: 1 },
  ],
  holes: [
    { id: 'hole-a-014', plotId: 'plot-a', marker: 'A-014', status: 'planted', plantName: 'ทุเรียน', variety: 'หมอนทอง', plantedOn: '2024-10-10' },
    { id: 'hole-b-001', plotId: 'plot-b', marker: 'B-001', status: 'empty', plantName: null, variety: null, plantedOn: null },
  ],
});
