import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const targetClient = JSON.parse(
  readFileSync(join(root, '.oracle-eye/expo-go/target-client.json'), 'utf8'),
);

const fail = (message) => {
  console.error(`EXPO_GO_COMPAT_FAIL: ${message}`);
  process.exit(1);
};

const expectEqual = (label, actual, expected) => {
  if (actual !== expected) {
    fail(`${label} expected ${expected}, received ${actual ?? 'undefined'}`);
  }
};

const expoRange = packageJson.dependencies?.expo;
if (!expoRange || !expoRange.includes('54.')) {
  fail(`package dependency expo must target SDK 54, received ${expoRange ?? 'missing'}`);
}

expectEqual('targetClient.targetSdkVersion', targetClient.targetSdkVersion, '54.0.0');
expectEqual(
  'targetClient.expectedRuntimeVersion',
  targetClient.expectedRuntimeVersion,
  'exposdk:54.0.0',
);

let configOutput = '';
try {
  configOutput = execFileSync(
    'npx',
    ['expo', 'config', '--type', 'public', '--json'],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, EXPO_NO_TELEMETRY: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
} catch (error) {
  fail(`expo public config failed: ${error.stderr?.toString().trim() || error.message}`);
}

let publicConfig;
try {
  publicConfig = JSON.parse(configOutput);
} catch {
  fail('expo public config did not return JSON');
}

expectEqual('expo public config sdkVersion', publicConfig.sdkVersion, '54.0.0');

console.log('EXPO_GO_COMPAT_PASS: package and public Expo config target SDK 54');
