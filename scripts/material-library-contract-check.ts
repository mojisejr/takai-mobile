import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { filterMaterialLibraryItems } from '../src/features/operations/materialCatalogFlow';
import type { MaterialLibraryItem } from '../src/features/operations/types';

const materials: MaterialLibraryItem[] = [
  { id: 'active-chemical', name: 'ยา A', type: 'fungicide', unit: 'cc', defaultRatePerTank: '20 cc / น้ำ 200 L', photoUri: null, lastUsedAt: null, usageCount: 2, archivedAt: null, notes: 'พ่นเชื้อรา', commonName: 'แมนโคเซบ', brandName: 'A', chemicalGroup: null, usageLabel: null, referenceAmount: 20, referenceUnit: 'cc', referenceWaterLitres: 200 },
  { id: 'active-fertilizer', name: 'ปุ๋ย B', type: 'fertilizer', unit: 'กรัม', defaultRatePerTank: null, photoUri: null, lastUsedAt: null, usageCount: 0, archivedAt: null, notes: null, commonName: null, brandName: null, chemicalGroup: null, usageLabel: null, referenceAmount: null, referenceUnit: null, referenceWaterLitres: null },
  { id: 'archived-tool', name: 'กรรไกร', type: 'tool', unit: 'อัน', defaultRatePerTank: null, photoUri: null, lastUsedAt: null, usageCount: 4, archivedAt: '2026-07-29T00:00:00.000Z', notes: 'ตัดกิ่ง', commonName: null, brandName: null, chemicalGroup: null, usageLabel: null, referenceAmount: null, referenceUnit: null, referenceWaterLitres: null },
];

const main = async (): Promise<void> => {
  assert.deepEqual(filterMaterialLibraryItems(materials, { archived: false, query: '', type: 'all' }).map((item) => item.id), ['active-chemical', 'active-fertilizer']);
  assert.deepEqual(filterMaterialLibraryItems(materials, { archived: false, query: 'แมนโคเซบ', type: 'chemical' }).map((item) => item.id), ['active-chemical'], 'search and type filter are presentation-only intersections');
  assert.deepEqual(filterMaterialLibraryItems(materials, { archived: true, query: 'ตัดกิ่ง', type: 'other' }).map((item) => item.id), ['archived-tool']);
  assert.equal(materials[2]?.archivedAt, '2026-07-29T00:00:00.000Z', 'filtering must not mutate archive state');

  const screen = await readFile(resolve(process.cwd(), 'src/features/operations/OperationalSliceScreen.tsx'), 'utf8');
  for (const token of ['materialCatalogMode === \'materialDetail\'', 'materialSearch', 'materialTypeFilter', 'beginMaterialDetail', 'เก็บวัสดุเข้าคลัง?', 'นำกลับมาใช้', 'ประวัติการใช้']) {
    assert.ok(screen.includes(token), `material library/detail contract missing: ${token}`);
  }
  assert.equal(screen.includes('onPress={() => beginMaterialEdit(material)}'), false, 'a Library row must not silently open edit mode');
  console.log('MATERIAL_LIBRARY_CONTRACT_PASS: list filters are pure and Material Detail owns edit/archive actions');
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
