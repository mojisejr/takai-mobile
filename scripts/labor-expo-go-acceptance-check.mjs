import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const fail = (message) => {
  console.error(`LABOR_EXPO_GO_ACCEPTANCE_FAIL: ${message}`);
  process.exit(1);
};
const readRequired = (relativePath) => {
  const fullPath = join(root, relativePath);
  if (!existsSync(fullPath)) fail(`missing ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
};

const doc = readRequired('.oracle-eye/expo-go/takai-payment-ia/README.md');
const evidence = JSON.parse(readRequired('.oracle-eye/expo-go/takai-payment-ia/operator-evidence.json'));
const target = JSON.parse(readRequired('.oracle-eye/expo-go/target-client.json'));

for (const phrase of [
  'Expo Go Device Eye Pending',
  'two-jobs-same-day',
  'unequal-hourly-workers',
  'group-piecework',
  'partial-advance-recovery',
  'bonus-separate-from-wage',
  'pay-by-work',
  'pay-by-person',
  'calendar-filter-review',
  'Touch targets',
  'Scrolling',
  'Keyboard',
  'Safe area and Thai layout',
  'Acceptance decision',
  'Native Eye Pending',
]) {
  if (!doc.includes(phrase)) fail(`scenario card missing phrase: ${phrase}`);
}

if (evidence.lane !== 'expo-go-device-eye') fail(`lane must be expo-go-device-eye, received ${evidence.lane}`);
if (evidence.status !== 'pending_operator' || evidence.claimLabel !== 'Expo Go Device Eye Pending') {
  fail('template must remain an explicit pending operator lane');
}
if (evidence.capturedAt !== null || evidence.operatorAcceptance?.accepted !== null) {
  fail('template cannot contain fabricated capture or acceptance values');
}
if (evidence.client?.expectedSdkVersion !== target.targetSdkVersion || evidence.client?.expectedRuntimeVersion !== target.expectedRuntimeVersion) {
  fail('template client compatibility expectation must match target-client.json');
}

const requiredScenarios = [
  'two-jobs-same-day',
  'unequal-hourly-workers',
  'group-piecework',
  'partial-advance-recovery',
  'bonus-separate-from-wage',
  'pay-by-work',
  'pay-by-person',
  'calendar-filter-review',
];
if (!Array.isArray(evidence.scenarios) || evidence.scenarios.length !== requiredScenarios.length) fail('scenario template must have exactly the eight Phase 5 scenarios');
for (const id of requiredScenarios) {
  const scenario = evidence.scenarios.find((item) => item.id === id);
  if (!scenario || scenario.status !== 'not_run' || typeof scenario.expected !== 'string' || !scenario.expected.trim()) {
    fail(`scenario ${id} must remain pending with an expected result`);
  }
}

for (const key of ['touchTargets', 'scrolling', 'keyboard', 'safeAreaAndThaiLayout', 'workVsPaymentComprehension', 'groupVsPersonMoneyComprehension', 'relaunchPersistence']) {
  if (evidence.observations?.[key]?.status !== 'not_run' || evidence.observations[key].note !== null) {
    fail(`observation ${key} must remain unobserved in the template`);
  }
}

console.log('LABOR_EXPO_GO_ACCEPTANCE_PASS: pending operator scenario card has all required Phase 5 cases and no fabricated device claim');
