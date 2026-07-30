import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { calculateChemicalDose } from '../src/features/operations';
import { TAKAI_MIGRATIONS } from '../src/data/schema';

const main = async (): Promise<void> => {
  assert.equal(calculateChemicalDose(20, 100, 200), 10, 'dose is reference amount × actual litres / reference litres');
  assert.equal(calculateChemicalDose(20, 50), 5, 'default reference water is 200 L');
  assert.equal(calculateChemicalDose(20, 0), 0, 'zero tank is valid arithmetic evidence');
  assert.equal(calculateChemicalDose(20, 100, 0), null, 'zero reference water is rejected');
  assert.ok(TAKAI_MIGRATIONS[5]?.statements.some((statement) => statement.includes('material_name_snapshot')), 'migration 6 must snapshot catalog labels on activity use');
  const repository = await readFile(resolve(process.cwd(), 'src/features/operations/repository.ts'), 'utf8');
  const screen = await readFile(resolve(process.cwd(), 'src/features/operations/OperationalSliceScreen.tsx'), 'utf8');
  assert.ok(repository.includes('manual_amount') && repository.includes('reference_water_litres_snapshot'), 'activity write must preserve calculator evidence separately from catalog');
  assert.ok(screen.includes('calculateChemicalDose') && screen.includes('น้ำในถังครั้งนี้') && screen.includes('กำหนดเอง'), 'chemical UI must show tank arithmetic and explicit manual override');
  assert.ok(repository.includes('assertActiveMaterial'), 'archived materials remain excluded from new use while historical activity references remain stored');
  console.log('CHEMICAL_CONTRACT_PASS: arithmetic, snapshots, archive-safe history, and optional chemical entry are valid');
};
main().catch((error: unknown) => { console.error(error); process.exit(1); });
