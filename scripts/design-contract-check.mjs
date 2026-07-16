import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const tokenFile = join(root, 'src/theme/tokens.ts');
const uiIndexFile = join(root, 'src/ui/index.ts');
const designLabFile = join(root, 'src/features/design-lab/DesignLabScreen.tsx');

const fail = (message) => {
  console.error(`DESIGN_CONTRACT_FAIL: ${message}`);
  process.exitCode = 1;
};

const requireFile = (relativePath) => {
  const fullPath = join(root, relativePath);
  if (!existsSync(fullPath)) {
    fail(`missing file ${relativePath}`);
  }
  return fullPath;
};

const tokenSource = existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8') : '';
const uiIndexSource = existsSync(uiIndexFile) ? readFileSync(uiIndexFile, 'utf8') : '';
const designLabSource = existsSync(designLabFile) ? readFileSync(designLabFile, 'utf8') : '';

const expectedTokens = {
  'color.primary.green': '#2E7D32',
  'color.surface.sand': '#F4E9D8',
  'color.text.primary': '#1F2D1F',
  'radius.card': '12',
  'typography.body.size': '16',
};

for (const [name, value] of Object.entries(expectedTokens)) {
  const escapedName = name.replaceAll('.', '\\.');
  const tokenPattern = new RegExp(`['"]${escapedName}['"]\\s*:\\s*['"]${value}['"]`);
  if (!tokenPattern.test(tokenSource)) {
    fail(`token ${name} does not expose expected contract value ${value}`);
  }
}

const primitives = [
  ['AppShell', 'src/ui/AppShell.tsx'],
  ['TopBar', 'src/ui/TopBar.tsx'],
  ['BottomTabBar', 'src/ui/BottomTabBar.tsx'],
  ['SectionHeader', 'src/ui/SectionHeader.tsx'],
  ['StatusChip', 'src/ui/StatusChip.tsx'],
  ['TrackerCard', 'src/ui/TrackerCard.tsx'],
  ['RecordListItem', 'src/ui/RecordListItem.tsx'],
  ['EvidenceTimeline', 'src/ui/EvidenceTimeline.tsx'],
  ['FieldCard', 'src/ui/FieldCard.tsx'],
  ['PrimaryButton', 'src/ui/PrimaryButton.tsx'],
];

for (const [name, relativePath] of primitives) {
  requireFile(relativePath);
  if (!uiIndexSource.includes(`export { ${name} }`)) {
    fail(`primitive ${name} is not exported from src/ui/index.ts`);
  }

  if (!designLabSource.includes(name)) {
    fail(`primitive ${name} is not rendered or imported by the Design Lab`);
  }
}

requireFile('assets/brand/takai-mascot.png');
requireFile('src/features/design-lab/DesignLabScreen.tsx');

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('DESIGN_CONTRACT_PASS: tokens and primitive exports match DESIGN.md');
