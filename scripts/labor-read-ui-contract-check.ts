import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const main = async (): Promise<void> => {
const root = process.cwd();
const source = await readFile(resolve(root, 'src/features/labor-mvp/LaborMvpApp.tsx'), 'utf8');
const adapter = await readFile(resolve(root, 'src/features/labor-mvp/preview.ts'), 'utf8');
const web = await readFile(resolve(root, 'src/features/labor-mvp/preview.web.ts'), 'utf8');
const eye = await readFile(resolve(root, 'scripts/rn-web-eye-check.mjs'), 'utf8');

for (const required of ['TodayScreen', 'WorkScreen', 'PeopleScreen', 'RecordScreen', 'PaymentScreen', 'DatePickerField', 'TaskList', 'ObligationList', 'ชุดงานเหมา']) {
  assert.ok(source.includes(required), `Labor read UI must include ${required}`);
}
for (const forbidden of ['OperationalSliceScreen', 'Activity Capture', 'plot_id']) assert.ok(!source.includes(forbidden), `Labor read UI must not revive legacy ${forbidden}`);
for (const method of ['getToday', 'getCalendar', 'getHistory', 'getPerson', 'getUnpaid', 'getMoneyHistory']) assert.ok((await readFile(resolve(root, 'src/features/labor-mvp/previewV2Adapter.ts'), 'utf8')).includes(method), `V2 adapter must expose ${method}`);
assert.ok(source.includes('minWidth: 0'), 'Thai rows with trailing values need a narrow-screen guard');
assert.ok(eye.includes("'.oracle-eye', 'rn-web', phase"), 'RN Web lane must write to the explicit RN Web artifact sink');
assert.ok(eye.includes('RN Web Eye Pending'), 'export-only runner must not claim a closed RN Web Eye');
console.log('LABOR_READ_UI_CONTRACT_PASS: read-first views, narrow calendar, projection adapter, and honest RN Web lane are present');
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
