import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const phase = 'takai-chemical-v2-history-proof';
const fail = (message) => { console.error(`LABOR_V2_CHEMICAL_HISTORY_PROOF_FAIL: ${message}`); process.exit(1); };
const read = (path) => { const full = join(root, path); if (!existsSync(full)) fail(`missing ${path}`); return readFileSync(full, 'utf8'); };
const manifest = JSON.parse(read(`.oracle-eye/rn-web/${phase}/manifest.json`));
const device = JSON.parse(read(`.oracle-eye/expo-go/${phase}/operator-evidence.json`));
const repository = read('src/features/labor-mvp/repositoryV2.ts');
const taskDetail = read('src/features/labor-mvp/LaborMvpApp.tsx');
const chemicalDetail = read('src/features/labor-mvp/ChemicalManagement.tsx');

for (const marker of ['common_name_snapshot', 'reference_amount_snapshot', 'reference_unit_snapshot', 'reference_water_litres_snapshot', 'calculated_amount', 'JOIN labor_v2_work_tasks task', 'lastUsedOn']) if (!repository.includes(marker)) fail(`chemical read projection lacks ${marker}`);
for (const marker of ['ยา / เคมีที่ใช้', 'น้ำที่ใช้ร่วมกัน', 'รายการด้านล่างจะไม่เปลี่ยนตามคลังยาปัจจุบัน']) if (!taskDetail.includes(marker)) fail(`task detail lacks ${marker}`);
for (const marker of ['ประวัติการใช้', 'ใช้ล่าสุด', 'detail.usages']) if (!chemicalDetail.includes(marker)) fail(`chemical detail lacks ${marker}`);
if (manifest.lane !== 'rn-web-eye' || manifest.claimLabel !== 'RN Web Eye Closed') fail('RN Web manifest must be explicitly closed');
if (manifest.browserEvidence?.consoleErrorCount !== 0 || manifest.browserEvidence?.failedRequestCount !== 0) fail('RN Web browser evidence must have zero console errors and failed requests');
const screens = manifest.browserEvidence?.screens ?? [];
for (const id of ['chemical-library-list', 'chemical-library-history', 'chemical-task-detail', 'chemical-task-snapshot-reference', 'chemical-mix-quick-add', 'chemical-quick-add-picker']) for (const viewport of ['390x844', '320x844']) {
  const item = screens.find((screen) => screen.flow === id && screen.viewport === viewport);
  if (!item || item.horizontalOverflow !== 'none observed' || !item.screenshotPaths?.length) fail(`missing clean ${id} evidence at ${viewport}`);
}
if (device.lane !== 'expo-go-device-eye' || device.status !== 'passed_operator' || device.claimLabel !== 'Expo Go Device Eye Closed') fail('Expo Go card must record the accepted operator result');
if (!device.capturedAt || device.operatorAcceptance?.accepted !== true || !device.operatorAcceptance?.operatorNameOrRole) fail('Expo Go closure requires a timestamped human acceptance record');
for (const observation of Object.values(device.observations ?? {})) if (observation.status !== 'passed') fail('Expo Go closure requires each declared observation to be passed');
console.log('LABOR_V2_CHEMICAL_HISTORY_PROOF_PASS: durable snapshot details, Thai read UI, RN Web evidence, and accepted Expo Go operator card are aligned');
