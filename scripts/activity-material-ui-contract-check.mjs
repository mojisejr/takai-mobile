import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../src/features/operations/OperationalSliceScreen.tsx', import.meta.url), 'utf8');
const repository = readFileSync(new URL('../src/features/operations/repository.ts', import.meta.url), 'utf8');

const requiredScreenTokens = [
  '1. งานและสถานที่',
  '2. บันทึก',
  '3. วัสดุครั้งนี้',
  '4. ผู้ร่วมงานและค่าแรง',
  '5. ติดตามต่อ (ถ้ามี)',
  'ไม่มีวัสดุในครั้งนี้',
  '+ เลือกวัสดุ',
  'เพิ่มและเลือกวัสดุ',
  'MaterialSummary',
  'รายละเอียดวัสดุ',
  'น้ำในถังครั้งนี้ (L)',
  'คำนวณอัตโนมัติ:',
  'กำหนดปริมาณเอง (ขั้นสูง)',
  'กลับไปใช้ค่าคำนวณอัตโนมัติ',
  'ChemicalCatalogFields',
  'ชื่อสามัญ / ชื่อเรียก',
  'ชื่อยี่ห้อ (ถ้ามี)',
  'น้ำอ้างอิง (L)',
  'คลังวัสดุ',
  'เก็บวัสดุเข้าแฟ้ม',
  'นำกลับมาใช้',
  'selectedPlotId',
  'activityDateDraft',
  'materialUsages.map',
];

for (const token of requiredScreenTokens) {
  if (!screen.includes(token)) throw new Error(`activity/material UI contract missing: ${token}`);
}

for (const forbiddenToken of ['options.materials.slice(0, 4)', 'parsedAmount > 0 ? parsedAmount : 1']) {
  if (screen.includes(forbiddenToken)) throw new Error(`activity/material UI regression found: ${forbiddenToken}`);
}

for (const token of ['materials: materialUsages.map', 'waterVolume: usage.actualTankLitres', 'dilutionText: usage.dilutionText', 'sortOrder: index', 'manualOverride && Number(usage.manualAmount) > 0']) {
  if (!screen.includes(token)) throw new Error(`field payload contract missing: ${token}`);
}

for (const token of ['export const createMaterial', 'export const updateMaterial', 'export const archiveMaterial', 'export const restoreMaterial']) {
  if (!repository.includes(token)) throw new Error(`catalog repository contract missing: ${token}`);
}

console.log('TAKAI activity-material UI contract passed');
