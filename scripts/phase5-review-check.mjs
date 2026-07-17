import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const fail = (message) => {
  console.error(`PHASE5_REVIEW_FAIL: ${message}`);
  process.exit(1);
};

const readRequired = (relativePath) => {
  const fullPath = join(root, relativePath);
  if (!existsSync(fullPath)) {
    fail(`missing ${relativePath}`);
  }
  return readFileSync(fullPath, 'utf8');
};

const doc = readRequired('docs/phase-5-local-v1-review.md');
const manifest = JSON.parse(
  readRequired('.oracle-eye/expo-go/phase-5-local-v1-review-manifest.json'),
);

const requiredDocPhrases = [
  'Local v1 Review',
  'Real Workday Trial',
  'Known Gaps List',
  'Local Backup And Export Decision',
  'Supabase Sync Seam Review',
  'Next Release Decision',
  'expo-go-device-eye',
  'operator_pending',
];

for (const phrase of requiredDocPhrases) {
  if (!doc.includes(phrase)) {
    fail(`review doc missing phrase: ${phrase}`);
  }
}

if (manifest.phase !== '5') {
  fail(`manifest phase expected 5, received ${manifest.phase}`);
}

if (manifest.lane !== 'expo-go-device-eye') {
  fail(`manifest lane expected expo-go-device-eye, received ${manifest.lane}`);
}

if (manifest.status !== 'operator_pending') {
  fail(`manifest status must remain operator_pending until Android proof closes`);
}

if (!Array.isArray(manifest.trialChecklist) || manifest.trialChecklist.length < 8) {
  fail('manifest trialChecklist must contain the real workday trial steps');
}

if (!manifest.decisionOptions?.includes('start-supabase-sync-plan')) {
  fail('manifest must keep Supabase as an explicit decision option, not implicit work');
}

if (manifest.truthState?.expoGoDeviceEye !== 'pending-human-device-proof') {
  fail('manifest must not claim Expo Go Device Eye Closed before operator proof');
}

console.log('PHASE5_REVIEW_PASS: local v1 review checklist and decision contract are valid');
