import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const phase = process.env.TAKAI_RN_STATIC_EYE_PHASE || 'takai-v2-read-ux-restoration';
const sink = join(root, '.oracle-eye', 'rn-static', phase);
const manifestPath = join(sink, 'manifest.json');
const checks = ['test:warm-notebook-foundation', 'test:warm-notebook-primitives', 'test:warm-notebook-read-money', 'test:warm-notebook-record', 'test:warm-notebook-responsive', 'test:design-contract', 'test:labor-navigation-ui', 'test:labor-read-ui', 'test:labor-v2-read-navigation-ui', 'test:labor-write-ui', 'test:labor-payment-batch-ui', 'test:labor-notebook-boundary'];

mkdirSync(sink, { recursive: true });
for (const check of checks) {
  execFileSync('npm', ['run', check], {
    cwd: root,
    env: { ...process.env, EXPO_NO_TELEMETRY: '1' },
    stdio: 'inherit',
  });
}

const manifest = {
  project: 'takai-mobile',
  phase,
  lane: 'rn-static-eye',
  claimLabel: 'RN Static Token Gate Closed',
  generatedAt: new Date().toISOString(),
  checks,
  notes: [
    'This lane verifies source-level navigation, primitive, route, and design-contract truth.',
    'It does not verify rendered layout, Android touch, native safe areas, or native Modal behaviour.',
  ],
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`RN_STATIC_EYE_PASS: manifest created at .oracle-eye/rn-static/${phase}/manifest.json`);
