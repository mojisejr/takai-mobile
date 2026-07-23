export type TakaiDatabase = {
  __platform: 'web-preview';
  closedCase: boolean;
  demoSprayCount: number;
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
  trackedCategoryIds: string[];
};

export const initializeTakaiDatabase = async (): Promise<TakaiDatabase> => ({
  __platform: 'web-preview',
  closedCase: false,
  demoSprayCount: 0,
  categories: [
    { id: 'cat-spray', name: 'พ่นยา', kind: 'spray', trackByDefault: true, sortOrder: 1, archivedAt: null },
    { id: 'cat-fertilizer', name: 'ใส่ปุ๋ย', kind: 'fertilizer', trackByDefault: true, sortOrder: 2, archivedAt: null },
    { id: 'cat-prune', name: 'แต่งกิ่ง', kind: 'prune', trackByDefault: true, sortOrder: 3, archivedAt: null },
  ],
  people: [
    { id: 'person-self', displayName: 'เจ้าของสวน', role: 'owner', isSelf: true, specialty: '', phone: '', note: '', archivedAt: null },
    { id: 'person-worker', displayName: 'สมชาย', role: 'worker', isSelf: false, specialty: 'พ่นยาและแต่งกิ่ง', phone: '081-234-5678', note: '', archivedAt: null },
  ],
  trackedCategoryIds: ['cat-spray', 'cat-fertilizer', 'cat-prune'],
});
