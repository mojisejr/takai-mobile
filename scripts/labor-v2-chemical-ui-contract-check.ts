import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const read = (path: string) => readFile(resolve(process.cwd(), path), 'utf8');
const main = async (): Promise<void> => {
  const [app, tabs, hub, chemicals, adapter, repository, design, editor] = await Promise.all([
    read('src/features/labor-mvp/LaborMvpApp.tsx'), read('src/ui/BottomTabBar.tsx'), read('src/features/labor-mvp/ManagementHub.tsx'), read('src/features/labor-mvp/ChemicalManagement.tsx'), read('src/features/labor-mvp/previewV2Adapter.ts'), read('src/features/labor-mvp/repositoryV2.ts'), read('DESIGN.md'), read('src/features/labor-mvp/LaborRecordGroupEditor.tsx'),
  ]);
  assert.ok(tabs.includes("key: 'manage'") && tabs.includes("label: 'จัดการ'"), 'fifth tab must be Management');
  assert.equal(tabs.includes("key: 'people'"), false, 'people must not remain a bottom tab');
  for (const marker of ['คนทำงาน', 'แปลง', 'คลังยา / เคมี']) assert.ok(hub.includes(marker), `management hub needs ${marker}`);
  for (const marker of ['ChemicalManagement', "managementRoute === 'people'", "managementRoute === 'plots'", "managementRoute === 'chemicals'"]) assert.ok(app.includes(marker), `management routes must wire ${marker}`);
  for (const marker of ['ชื่อสามัญ', 'วันที่เพิ่มรายการ', 'ระบุว่าหมดแล้ว', 'ประวัติรายการ', 'ประวัติการใช้', 'ใช้ล่าสุด', 'ไม่ต้องนับสต็อก', 'DatePickerField']) assert.ok(chemicals.includes(marker), `chemical library UI needs ${marker}`);
  for (const marker of ['chemicals:', 'createLaborV2Chemical', 'markLaborV2ChemicalEmpty']) assert.ok(adapter.includes(marker), `V2 adapter must expose ${marker}`);
  assert.ok(repository.includes('labor_v2_chemical_items') && repository.includes('labor_v2_chemical_revisions'), 'chemical repository must use additive V2 storage');
  assert.equal(`${chemicals}\n${repository}`.includes('FROM activity_materials'), false, 'V2 chemical library must not read retired activity materials');
  assert.equal(`${chemicals}\n${repository}`.includes('INSERT INTO activity_materials'), false, 'V2 chemical library must not write retired activity materials');
  assert.ok(design.includes('คลังยา / เคมี') && design.includes('not quantity inventory'), 'design contract must declare the bounded chemical library');
  for (const marker of ['ยา / เคมีที่ใช้ (ไม่บังคับ)', 'น้ำที่ใช้ร่วมกันทั้งชุดยา', 'เพิ่มยาแล้วเลือกกับงานนี้ทันที', 'ใช้หมดแล้ว', 'chemicalMix', 'งานที่ใส่ยาเลือกได้ 1 แปลงเท่านั้น', 'หากต้องใช้คนละแปลงหรือคนละสูตร ให้เพิ่มงานใหม่']) assert.ok(editor.includes(marker), `task capture needs ${marker}`);
  assert.ok(repository.includes('labor_v2_task_chemical_mixes') && repository.includes('labor_v2_task_chemical_uses'), 'task mix repository must use additive V2 storage');
  assert.ok(repository.includes('common_name_snapshot') && repository.includes('lastUsedOn') && repository.includes('JOIN labor_v2_work_tasks task'), 'chemical history must read immutable task-use snapshots and effective work dates');
  for (const marker of ['ยา / เคมีที่ใช้', 'น้ำที่ใช้ร่วมกัน', 'รายการด้านล่างจะไม่เปลี่ยนตามคลังยาปัจจุบัน']) assert.ok(app.includes(marker), `task detail UI needs ${marker}`);
  assert.ok(repository.includes("task.plotTargets.length > 1") && repository.includes('งานที่ใส่ยาเลือกได้ 1 แปลงเท่านั้น'), 'repository must reject a chemical mix spanning more than one plot');
  assert.ok(design.includes('shared-water chemical mix') && design.includes('Quick add stays inside the task picker'), 'design contract must declare task-mix capture and quick add');
  console.log('LABOR_V2_CHEMICAL_UI_CONTRACT_PASS: management hub, people/plot reachability, V2 chemical library, and retired V1 boundary are aligned');
};
main().catch((error: unknown) => { console.error(error); process.exit(1); });
