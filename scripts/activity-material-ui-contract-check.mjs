import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../src/features/operations/OperationalSliceScreen.tsx', import.meta.url), 'utf8');
const repository = readFileSync(new URL('../src/features/operations/repository.ts', import.meta.url), 'utf8');

const requiredScreenTokens = [
  '1. งาน · เป้าหมาย · วันเวลา',
  '2. บันทึก',
  '3. วัสดุครั้งนี้',
  '4. ผู้ร่วมงานและค่าแรง',
  '5. ติดตามต่อ (ถ้ามี)',
  '6. บันทึกลงสมุด',
  'ไม่มีวัสดุในครั้งนี้',
  '+ เพิ่มวัสดุ',
  'เพิ่มและเลือกวัสดุ',
  'น้ำ/อัตราผสม/โน้ต (ถ้ามี)',
  'คลังวัสดุ',
  'เก็บวัสดุเข้าแฟ้ม',
  'นำกลับมาใช้',
  'selectedPlotId',
  'performedAtDraft',
  'materialUsages.map',
];

for (const token of requiredScreenTokens) {
  if (!screen.includes(token)) throw new Error(`activity/material UI contract missing: ${token}`);
}

for (const forbiddenToken of ['options.materials.slice(0, 4)', 'parsedAmount > 0 ? parsedAmount : 1']) {
  if (screen.includes(forbiddenToken)) throw new Error(`activity/material UI regression found: ${forbiddenToken}`);
}

for (const token of ['materials: materialUsages.map', 'waterVolume: usage.waterVolume', 'dilutionText: usage.dilutionText', 'sortOrder: index']) {
  if (!screen.includes(token)) throw new Error(`field payload contract missing: ${token}`);
}

for (const token of ['export const createMaterial', 'export const updateMaterial', 'export const archiveMaterial', 'export const restoreMaterial']) {
  if (!repository.includes(token)) throw new Error(`catalog repository contract missing: ${token}`);
}

console.log('TAKAI activity-material UI contract passed');
