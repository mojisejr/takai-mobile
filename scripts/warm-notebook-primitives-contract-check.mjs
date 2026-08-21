import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), 'utf8');
const fail = (message) => { console.error(`WARM_NOTEBOOK_PRIMITIVES_FAIL: ${message}`); process.exit(1); };

const tabs = read('src/ui/BottomTabBar.tsx');
for (const marker of ['MaterialDesignIcons', 'takaiIconMap[tab.icon]', 'minHeight: 48', 'minWidth: 0', "label: 'วันนี้'", "label: 'คน'"]) if (!tabs.includes(marker)) fail(`five-tab notebook navigation missing ${marker}`);

const topBar = read('src/ui/TopBar.tsx');
for (const marker of ['takai-mascot-bust.png', '<IconDisc icon="info"', 'minHeight: 64', 'minHeight: 44']) if (!topBar.includes(marker)) fail(`branded header missing ${marker}`);

const primitives = read('src/ui/NotebookPrimitives.tsx');
for (const marker of ['IconDisc', 'AmountSummary', 'ListRowTrailing', 'GardenAccent', 'minWidth: 0', 'takaiIconMap']) if (!primitives.includes(marker)) fail(`notebook primitive missing ${marker}`);

const app = read('src/features/labor-mvp/LaborMvpApp.tsx');
if (app.includes('hideSubtitle title={tabTitle[tab]}') || app.includes('styles.pageTitle')) fail('page must use the header subtitle rather than duplicate an in-content page title');

const shell = read('src/ui/AppShell.tsx');
if (!shell.includes('scrollEnabled ? <ScrollView') || !shell.includes('styles.staticContent')) fail('AppShell must preserve sole Work FlatList scroll ownership');

for (const file of ['src/ui/FieldForm.tsx', 'src/ui/LaborFeedback.tsx']) {
  const source = read(file);
  if (!source.includes('presentationStyle="overFullScreen"') || source.includes('presentationStyle="pageSheet"')) fail(`${file} must retain Android-compatible transparent overFullScreen modals`);
}

console.log('WARM_NOTEBOOK_PRIMITIVES_PASS: branded header, five icon tabs, reusable notebook primitives, narrow rows, and supported sheets are present');
