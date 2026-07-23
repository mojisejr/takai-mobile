import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const fail = (message) => {
  console.error(`WORKERS_TRACKERS_UI_CONTRACT_FAIL: ${message}`);
  process.exit(1);
};
const read = (relativePath) => {
  const file = join(root, relativePath);
  if (!existsSync(file)) fail(`missing ${relativePath}`);
  return readFileSync(file, 'utf8');
};

const screen = read('src/features/operations/OperationalSliceScreen.tsx');
const repository = read('src/features/operations/repository.ts');
const recordListItem = read('src/ui/RecordListItem.tsx');

[
  "setSelectedCategoryId(categoryId)",
  "setSelectedWorkerId(personId)",
  "label={showInlineCategoryForm ? 'ซ่อนแบบฟอร์มเพิ่มหมวดงาน' : '+ เพิ่มหมวดงาน'}",
  "label={showInlineWorkerForm ? 'ซ่อนแบบฟอร์มเพิ่มคนงาน' : '+ เพิ่มคนงาน'}",
  "view === 'categories'",
  "view === 'workers'",
  "view === 'trackerManage'",
  'เก็บเข้าแฟ้มจะซ่อนจากการบันทึกใหม่ แต่ประวัติกิจกรรมเดิมยังอยู่ครบ',
  'การยืนยันจะบันทึกสถานะว่าจ่ายแล้ว ไม่ลบกิจกรรมหรือประวัติค่าแรงเดิม',
  'ยืนยันการจ่ายค่าแรง',
  'จากกิจกรรม {person.sourceCount} รายการ',
].forEach((contract) => {
  if (!screen.includes(contract)) fail(`screen missing ${contract}`);
});

if (!repository.includes('WHERE archived_at IS NULL') || !repository.includes('WHERE labor_entries.status = \'unpaid\'')) {
  fail('repository must keep active capture filtered and unpaid history readable');
}

if (recordListItem.includes('numberOfLines={1}')) {
  fail('record rows must allow long Thai labels and source context to wrap');
}

console.log('WORKERS_TRACKERS_UI_CONTRACT_PASS: picker refresh, archive, tracker, and settlement semantics are present');
