import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { filterPickerOptions, recentPickerOptions, type PickerOption } from '../src/ui/pickerOptions';

const options: PickerOption[] = [
  { id: 'active-spray', label: 'พ่นยา', meta: 'หมวดงานที่ใช้งานอยู่' },
  { id: 'active-worker', label: 'สมชาย', meta: 'คนงานที่ใช้งานอยู่' },
  { id: 'archived-worker', label: 'คนเก่า', meta: 'เก็บเข้าแฟ้ม' },
];

const main = async (): Promise<void> => {
  assert.deepEqual(filterPickerOptions(options.slice(0, 2), 'สมชาย').map((item) => item.id), ['active-worker'], 'query must filter active picker options');
  assert.deepEqual(recentPickerOptions(options.slice(0, 2), ['archived-worker', 'active-worker', 'active-spray']).map((item) => item.id), ['active-worker', 'active-spray'], 'recents must omit records absent from active-only options');
  assert.deepEqual(recentPickerOptions(options.slice(0, 2), ['active-spray', 'active-worker'], 1).map((item) => item.id), ['active-spray'], 'recents preserve most-recent order and limit');

  const screen = await readFile(resolve(process.cwd(), 'src/features/operations/OperationalSliceScreen.tsx'), 'utf8');
  const primitives = await readFile(resolve(process.cwd(), 'src/ui/FieldForm.tsx'), 'utf8');
  assert.ok(primitives.includes('function PickerField') && primitives.includes('function SearchPickerSheet') && primitives.includes('function FormSection') && primitives.includes('function StickySaveBar'), 'field primitives must be available');
  assert.ok(screen.includes("openActivityPicker('plot')") && screen.includes("openActivityPicker('target')"), 'Activity must choose plot before target through picker fields');
  assert.ok(screen.includes('quickAddActivityPicker') && screen.includes('recentPickerIds'), 'Activity pickers must return selection after quick-add and retain recents');
  assert.equal(screen.includes('showInlineCategoryForm') || screen.includes('showInlineMaterialForm') || screen.includes('showInlineWorkerForm'), false, 'Activity must not retain inline nested creation forms');
  assert.ok(screen.includes('flexBasis: 0') && screen.includes('minWidth: 0'), 'material amount/unit rows must be allowed to shrink inside a phone viewport');
  console.log('FIELD_FORM_CONTRACT_PASS: searchable, recent, archived-safe picker primitives and Activity picker flow are valid');
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
