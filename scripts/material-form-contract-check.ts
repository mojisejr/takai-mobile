import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const main = async (): Promise<void> => {
  const screen = await readFile(resolve(process.cwd(), 'src/features/operations/OperationalSliceScreen.tsx'), 'utf8');
  for (const token of [
    "materialCatalogMode === 'materialCreate' || materialCatalogMode === 'materialEdit'",
    'MaterialCatalogFormFields',
    'StickySaveBar disabled={materialSaving}',
    "materialSaving ? 'กำลังบันทึก…'",
    'if (materialSaving) return;',
    'cancelMaterialForm',
    'อัตราอ้างอิง (ถ้ามี)',
    'รายละเอียด (ถ้ามี)',
    'ชื่อสามัญ / ชื่อเรียก *',
  ]) assert.ok(screen.includes(token), `material add/edit form contract missing: ${token}`);
  const materialLibrarySection = screen.slice(screen.indexOf("{view === 'materials' ?"), screen.indexOf('<Modal animationType="slide" onRequestClose={cancelMaterialForm}'));
  assert.equal(materialLibrarySection.includes('ChemicalCatalogFields'), false, 'Library must not embed the Add/Edit form inline');
  assert.ok(screen.includes("setMaterialCatalogMode(isEditing ? 'materialDetail' : 'library')"), 'save must return edit to Detail and create to Library');
  console.log('MATERIAL_FORM_CONTRACT_PASS: dedicated progressive Add/Edit sheet, inline feedback, and saving lock are present');
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
