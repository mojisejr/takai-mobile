import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const main = async (): Promise<void> => {
  const root = process.cwd();
  const app = await readFile(resolve(root, 'src/features/labor-mvp/LaborMvpApp.tsx'), 'utf8');
  const tabs = await readFile(resolve(root, 'src/ui/BottomTabBar.tsx'), 'utf8');
  const topBar = await readFile(resolve(root, 'src/ui/TopBar.tsx'), 'utf8');
  const form = await readFile(resolve(root, 'src/ui/FieldForm.tsx'), 'utf8');
  const feedback = await readFile(resolve(root, 'src/ui/LaborFeedback.tsx'), 'utf8');

  for (const label of ['วันนี้', 'งาน', 'บันทึกงาน', 'จ่ายเงิน', 'คน']) assert.ok(tabs.includes(`label: '${label}'`), `bottom navigation must include ${label}`);
  assert.ok(!tabs.includes("label: 'เมนู'"), 'bottom navigation must not render the retired menu tab');
  for (const marker of ['TAKAI', 'takai-mascot-bust.png', 'onInfoPress', 'accessibilityLabel="วิธีใช้งาน"']) assert.ok(topBar.includes(marker), `brand header must include ${marker}`);
  for (const marker of ['ChoicePicker', 'MultiSearchPickerSheet', 'เลือกแล้ว {selected.length} คน', 'accessibilityRole="checkbox"', 'ข้อมูลคนทำงาน']) assert.ok(app.includes(marker) || form.includes(marker), `shared picker grammar must include ${marker}`);
  assert.ok(form.includes('presentationStyle="overFullScreen"') && feedback.includes('presentationStyle="overFullScreen"'), 'all sheet modals must use the supported transparent configuration');
  assert.ok(!form.includes('presentationStyle="pageSheet"') && !feedback.includes('presentationStyle="pageSheet"'), 'pageSheet with transparent must be retired');
  console.log('LABOR_NAVIGATION_UI_CONTRACT_PASS: exact tabs, branded help header, picker grammar, multi-person sheet, and supported modals are present');
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
