import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const sink = '.oracle-eye/expo-go/takai-v2-plot-context';
const fail = (message) => { console.error(`LABOR_V2_PLOT_EXPO_GO_ACCEPTANCE_FAIL: ${message}`); process.exit(1); };
const read = (path) => { const full = join(root, path); if (!existsSync(full)) fail(`missing ${path}`); return readFileSync(full, 'utf8'); };
const doc = read(`${sink}/README.md`);
const evidence = JSON.parse(read(`${sink}/operator-evidence.json`));

for (const phrase of ['Expo Go Device Eye Pending', 'npm run start', 'takai-local-v1.db', 'capture-empty-general-work', 'capture-multi-plot-target', 'quick-add-plot', 'tree-add-remove', 'archive-history-read-only', 'rename-detail-history', 'Picker search', 'Keyboard and scroll', 'Native Eye remains Pending']) {
  if (!doc.includes(phrase)) fail(`operator card missing ${phrase}`);
}
if (evidence.lane !== 'expo-go-device-eye' || evidence.status !== 'pending_operator' || evidence.claimLabel !== 'Expo Go Device Eye Pending') fail('template must remain an explicit pending device lane');
if (evidence.capturedAt !== null || evidence.operatorAcceptance?.accepted !== null) fail('template cannot fabricate observation or acceptance');
if (evidence.client?.expectedSdkVersion !== '54.0.0' || evidence.client?.expectedRuntimeVersion !== 'exposdk:54.0.0') fail('template must declare the Expo Go baseline');
for (const id of ['capture-empty-general-work', 'capture-multi-plot-target', 'quick-add-plot', 'tree-add-remove', 'archive-history-read-only', 'rename-detail-history']) {
  const scenario = evidence.scenarios?.find((item) => item.id === id);
  if (!scenario || scenario.status !== 'not_run' || !scenario.expected || scenario.operatorResult !== null) fail(`${id} must remain an unobserved operator scenario`);
}
for (const key of ['coldOpen', 'touchTargets', 'pickerSearch', 'keyboardAndScrolling', 'safeAreaAndThaiLayout', 'plotMoneyComprehension']) {
  if (evidence.observations?.[key]?.status !== 'not_run' || evidence.observations[key].note !== null) fail(`${key} must remain unobserved`);
}
console.log('LABOR_V2_PLOT_EXPO_GO_ACCEPTANCE_PASS: exact plot-context operator card is prepared and truthfully pending');
