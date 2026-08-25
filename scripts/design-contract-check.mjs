import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const fail = (message) => { console.error(`DESIGN_CONTRACT_FAIL: ${message}`); process.exitCode = 1; };
const requireFile = (relativePath) => {
  if (!existsSync(join(root, relativePath))) fail(`missing file ${relativePath}`);
};

const design = read('DESIGN.md');
const tokenSource = read('src/theme/tokens.ts');
const uiIndexSource = read('src/ui/index.ts');
const appSource = read('App.tsx');
const tabSource = read('src/ui/BottomTabBar.tsx');
const webPreviewSource = read('src/data/index.web.ts');
const webFixtureGeneratorSource = read('scripts/generate-labor-v2-preview-web-fixture.ts');
const laborPreviewSource = read('src/features/labor-mvp/previewV2.ts');

if (!design.includes('design_md_version: 3')) fail('DESIGN.md must declare Warm Garden Notebook design contract v3');
for (const lane of ['kind: rn-static-eye', 'kind: rn-web-eye', 'kind: expo-go-device-eye']) {
  if (!design.includes(lane)) fail(`DESIGN.md must declare ${lane} proof lane`);
}
for (const label of ['วันนี้', 'งาน', 'บันทึกงาน', 'จ่ายเงิน', 'จัดการ']) {
  if (!design.includes(label) || !tabSource.includes(`label: '${label}'`)) fail(`Labor navigation missing ${label}`);
}
if (tabSource.includes("label: 'เมนู'")) fail('Labor navigation must retire the menu tab');
for (const forbidden of ["'plots'", "'activity'", "'cases'"]) {
  if (tabSource.includes(forbidden)) fail(`legacy tab key remains in BottomTabBar: ${forbidden}`);
}
if (!appSource.includes('LaborMvpApp') || appSource.includes('OperationalSliceScreen')) fail('App must mount LaborMvpApp only');
if (!webPreviewSource.includes('createWebLaborV2PreviewAdapter') || !webFixtureGeneratorSource.includes('runMigrations') || !webFixtureGeneratorSource.includes('buildLaborV2PreviewFixture') || !laborPreviewSource.includes('buildLaborV2PreviewFixture')) {
  fail('web preview must use the repository-generated V2 fixture adapter');
}

const expectedTokens = {
  'color.primary.green': '#2E7D32',
  'color.surface.sand': '#F7F1E5',
  'color.text.primary': '#1F2D1F',
  'radius.card': '24',
  'typography.body.size': '17',
};
for (const [name, value] of Object.entries(expectedTokens)) {
  const escapedName = name.replaceAll('.', '\\.');
  if (!new RegExp(`['"]${escapedName}['"]\\s*:\\s*['"]${value}['"]`).test(tokenSource)) {
    fail(`token ${name} does not expose expected contract value ${value}`);
  }
}

for (const [name, relativePath] of [
  ['AppShell', 'src/ui/AppShell.tsx'], ['TopBar', 'src/ui/TopBar.tsx'], ['BottomTabBar', 'src/ui/BottomTabBar.tsx'],
  ['FieldCard', 'src/ui/FieldCard.tsx'], ['SectionHeader', 'src/ui/SectionHeader.tsx'], ['PrimaryButton', 'src/ui/PrimaryButton.tsx'], ['StatusChip', 'src/ui/StatusChip.tsx'],
]) {
  requireFile(relativePath);
  if (!uiIndexSource.includes(`export { ${name} }`)) fail(`primitive ${name} is not exported from src/ui/index.ts`);
}
requireFile('src/features/labor-mvp/LaborMvpApp.tsx');
requireFile('src/features/labor-mvp/previewV2.ts');

if (process.exitCode) process.exit(process.exitCode);
console.log('DESIGN_CONTRACT_PASS: Labor MVP v2 navigation, route, preview adapter, tokens, and primitives are aligned');
