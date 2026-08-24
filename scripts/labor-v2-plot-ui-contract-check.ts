import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const read = (path: string) => readFile(resolve(process.cwd(), path), 'utf8');

const main = async (): Promise<void> => {
  const [editor, app, adapter, plots, form, design, tabs] = await Promise.all([
    read('src/features/labor-mvp/LaborRecordGroupEditor.tsx'),
    read('src/features/labor-mvp/LaborMvpApp.tsx'),
    read('src/features/labor-mvp/previewV2Adapter.ts'),
    read('src/features/labor-mvp/PlotManagement.tsx'),
    read('src/ui/FieldForm.tsx'),
    read('DESIGN.md'),
    read('src/ui/BottomTabBar.tsx'),
  ]);

  for (const marker of ['พื้นที่ที่ทำงาน (ไม่บังคับ)', 'MultiSearchPickerSheet', 'เพิ่มแปลงเล็ก ๆ แล้วเลือกทันที', 'ต้นที่เกี่ยวข้อง (ไม่บังคับ)', 'plotTargets']) assert.ok(editor.includes(marker), `capture must include ${marker}`);
  assert.ok(editor.includes('treeLabels.map') && editor.includes('new Set(trees).size'), 'tree references must remain editable, validated draft rows');
  for (const marker of ['plots:', 'listLaborV2Plots', 'getLaborV2PlotDetail', 'restoreLaborV2Plot']) assert.ok(adapter.includes(marker), `adapter must expose V2 plot ${marker}`);
  for (const marker of ['จัดการแปลง', 'ประวัติชื่อและการเปลี่ยนแปลง', 'เก็บแปลงนี้ไว้', 'นำแปลงกลับมาใช้', 'ConfirmActionSheet']) assert.ok(plots.includes(marker), `route-local plot management must include ${marker}`);
  for (const marker of ['พื้นที่ที่ทำงาน', 'ชื่อเดิมเมื่อบันทึก', 'treeLabels', 'onManagePlots']) assert.ok(app.includes(marker), `task detail and route wiring must include ${marker}`);
  assert.ok(form.includes('quickAdd?: ReactNode') && form.includes('{quickAdd ? <View style={styles.quickAdd}>'), 'multi-search picker must offer a bounded quick-add seam');
  assert.ok(design.includes('route-local') && design.includes('five-tab') && design.includes('takai-v2-plot-context'), 'design contract must preserve route-local five-tab V2 plot truth');
  for (const key of ["'today'", "'work'", "'record'", "'payment'", "'people'"]) assert.ok(tabs.includes(key), `navigation must retain ${key}`);
  assert.equal(tabs.includes("'plots'"), false, 'plot management must not become a sixth tab');
  assert.equal(`${editor}\n${app}\n${plots}`.includes('OperationalSliceScreen'), false, 'legacy Operations UI must remain retired');
  console.log('LABOR_V2_PLOT_UI_CONTRACT_PASS: route-local multi-plot capture, tree rows, history-safe task detail, management commands, and five-tab navigation are aligned');
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
