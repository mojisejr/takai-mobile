import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const sink = '.oracle-eye/expo-go/takai-compensation-v2';
const historicalSink = '.oracle-eye/expo-go/takai-payment-ia';
const fail = (message) => {
  console.error(`LABOR_EXPO_GO_ACCEPTANCE_FAIL: ${message}`);
  process.exit(1);
};
const readRequired = (relativePath) => {
  const fullPath = join(root, relativePath);
  if (!existsSync(fullPath)) fail(`missing ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
};

const doc = readRequired(`${sink}/README.md`);
const evidence = JSON.parse(readRequired(`${sink}/operator-evidence.json`));
const target = JSON.parse(readRequired('.oracle-eye/expo-go/target-client.json'));
readRequired(`${historicalSink}/README.md`);
readRequired(`${historicalSink}/operator-evidence.json`);

for (const phrase of [
  'Expo Go Device Eye Pending',
  'npm run start',
  'takai-local-v1.db',
  'daily-three-tasks-one-wage',
  'daily-plus-open-two-member-contract',
  'one-person-contract-batch',
  'contract-finalization-group-payout',
  'unequal-hourly-workers',
  'partial-wage-bonus-person-advance-recovery',
  'calendar-person-payment-history',
  'Cold open',
  'Touch',
  'Scroll',
  'Keyboard',
  'Safe area/Thai layout',
  'Persistence',
  'Acceptance decision',
  'Native Eye remains Pending',
]) {
  if (!doc.includes(phrase)) fail(`V2 operator card missing phrase: ${phrase}`);
}

if (evidence.lane !== 'expo-go-device-eye') fail(`lane must be expo-go-device-eye, received ${evidence.lane}`);
if (evidence.status !== 'pending_operator' || evidence.claimLabel !== 'Expo Go Device Eye Pending') {
  fail('V2 template must remain an explicit pending operator lane');
}
if (evidence.capturedAt !== null || evidence.operatorAcceptance?.accepted !== null) {
  fail('V2 template cannot contain fabricated capture or acceptance values');
}
if (evidence.client?.expectedSdkVersion !== target.targetSdkVersion || evidence.client?.expectedRuntimeVersion !== target.expectedRuntimeVersion) {
  fail('V2 template client compatibility expectation must match target-client.json');
}
if (evidence.dataSafety?.notebookDatabase !== 'takai-local-v1.db' || evidence.dataSafety?.resetUsed !== null) {
  fail('V2 template must identify the notebook and leave reset unobserved');
}

const requiredScenarios = [
  'daily-three-tasks-one-wage',
  'daily-plus-open-two-member-contract',
  'one-person-contract-batch',
  'contract-finalization-group-payout',
  'unequal-hourly-workers',
  'partial-wage-bonus-person-advance-recovery',
  'calendar-person-payment-history',
];
if (!Array.isArray(evidence.scenarios) || evidence.scenarios.length !== requiredScenarios.length) fail('V2 scenario template must have exactly seven required scenarios');
for (const id of requiredScenarios) {
  const scenario = evidence.scenarios.find((item) => item.id === id);
  if (!scenario || scenario.status !== 'not_run' || typeof scenario.expected !== 'string' || !scenario.expected.trim() || scenario.operatorResult !== null) {
    fail(`scenario ${id} must remain unobserved with an expected result`);
  }
}

for (const key of ['coldOpen', 'touchTargets', 'scrolling', 'keyboard', 'safeAreaAndThaiLayout', 'workMoneyComprehension', 'groupPersonRecoveryComprehension', 'relaunchPersistence']) {
  if (evidence.observations?.[key]?.status !== 'not_run' || evidence.observations[key].note !== null) {
    fail(`observation ${key} must remain unobserved in the V2 template`);
  }
}

console.log('LABOR_EXPO_GO_ACCEPTANCE_PASS: V2 pending operator card preserves V1 history, covers compensation-unit scenarios, and contains no fabricated device claim');
