import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const main = async (): Promise<void> => {
  const screen = await readFile(resolve(process.cwd(), 'src/features/operations/OperationalSliceScreen.tsx'), 'utf8');
  for (const token of [
    'const beginActivityMaterialCreate',
    "beginMaterialCreate({ source: 'activity', usageKey })",
    "label=\"+ เพิ่มวัสดุใหม่\"",
    "materialReturnIntent?.source === 'activity'",
    "label={materialSaving ? 'กำลังบันทึก…' : materialCatalogMode === 'materialEdit' ? 'บันทึกการแก้ไข' : materialReturnIntent?.source === 'activity' ? 'เพิ่มและใช้กับกิจกรรมนี้' : 'เพิ่มวัสดุ'}",
    'setMaterialDetailKey(materialReturnIntent.usageKey)',
    "setView('activity')",
    'materialUsageValidationError',
    'กรุณาระบุน้ำในถังให้มากกว่า 0 L',
    'กรุณาระบุปริมาณที่ใช้ให้มากกว่า 0',
    'กรุณาระบุหน่วยของปริมาณที่ใช้',
    'ปริมาณนี้ล็อกไว้',
    'StickySaveBar disabled={Boolean(materialDetailError)}',
  ]) assert.ok(screen.includes(token), `activity material return contract missing: ${token}`);

  const pickerStart = screen.indexOf("activityPicker?.kind === 'material'");
  const pickerEnd = screen.indexOf('const materialDetail =', pickerStart);
  const materialPicker = screen.slice(pickerStart, pickerEnd);
  assert.equal(materialPicker.includes('TextInput'), false, 'Activity material picker must remain search/select only');
  assert.equal(materialPicker.includes('MaterialCatalogFormFields'), false, 'Activity material picker must not embed catalog form fields');
  console.log('ACTIVITY_MATERIAL_RETURN_CONTRACT_PASS: picker, explicit create return, locked dose, and row errors are present');
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
