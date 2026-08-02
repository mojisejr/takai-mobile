import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const phase = process.env.TAKAI_RN_WEB_EYE_PHASE || 'labor-calendar-mvp';
const sink = join(root, '.oracle-eye', 'rn-web', phase);
const exportDir = join(sink, 'export');
const manifestPath = join(sink, 'manifest.json');

const fail = (message) => {
  console.error(`RN_WEB_EYE_FAIL: ${message}`);
  process.exit(1);
};

rmSync(exportDir, { recursive: true, force: true });
mkdirSync(sink, { recursive: true });

try {
  execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', exportDir], {
    cwd: root,
    env: { ...process.env, EXPO_NO_TELEMETRY: '1' },
    stdio: 'inherit',
  });
} catch (error) {
  fail(`expo web export failed (${error.status ?? 'unknown status'})`);
}

const indexPath = join(exportDir, 'index.html');
if (!existsSync(indexPath)) {
  fail(`missing export artifact ${indexPath}`);
}

const manifest = {
  project: 'takai-mobile',
  phase,
  lane: 'rn-web-eye',
  claimLabel: 'RN Web Eye Pending',
  generatedAt: new Date().toISOString(),
  viewport: '390x844 target for browser capture',
  exportDir: `.oracle-eye/rn-web/${phase}/export`,
  artifacts: {
    exportIndex: `.oracle-eye/rn-web/${phase}/export/index.html`,
    browserScreenshot: `.oracle-eye/rn-web/${phase}/browser/today-390x844.png`,
    browserEvidence: `.oracle-eye/rn-web/${phase}/browser/browser-evidence.json`,
    manifest: `.oracle-eye/rn-web/${phase}/manifest.json`,
  },
  notes: [
    'This script closes RN Web export readiness and records the artifact sink only.',
    'RN Web Eye remains Pending until browser screenshot, console, and network evidence are captured in this sink.',
    'This lane does not close Expo Go Device Eye or Native Eye.',
  ],
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`RN_WEB_EYE_PASS: export artifact created at ${manifest.artifacts.exportIndex}`);
