import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const fail = (message) => { console.error(`WARM_NOTEBOOK_RESPONSIVE_FAIL: ${message}`); process.exit(1); };

const primitives = read('src/ui/NotebookPrimitives.tsx');
for (const marker of ["flexWrap: 'wrap'", "flexBasis: '30%'", 'minWidth: 84', 'amountLabel}>{item.label}', 'amountValue}>{item.value}']) if (!primitives.includes(marker)) fail(`summary cards must wrap and keep complete ${marker}`);
if (primitives.includes('numberOfLines={1} style={styles.amount')) fail('summary labels and values must not be silently truncated');

const shell = read('src/ui/AppShell.tsx');
for (const marker of ["Platform.OS === 'ios' ? 'padding' : 'height'", 'keyboardHeight + tokens.spacing.section', 'keyboardDismissMode="on-drag"']) if (!shell.includes(marker)) fail(`keyboard-aware shell missing ${marker}`);

const appConfig = read('app.json');
if (!appConfig.includes('"softwareKeyboardLayoutMode": "resize"')) fail('Android must request resize keyboard layout for native builds');

const laborUi = read('src/features/labor-mvp/LaborMvpApp.tsx');
if (laborUi.includes('ข้อมูลจากระบบเดิม') || laborUi.includes('ready.adapter.legacyRead')) fail('legacy V1 context must stay archived and unrendered in the active V2 UI');

const topBar = read('src/ui/TopBar.tsx');
if (!topBar.includes('mascot: { height: 48, width: 48 }')) fail('header mascot must use the enlarged visual size');

console.log('WARM_NOTEBOOK_RESPONSIVE_PASS: complete responsive summaries, legacy-hidden V2 UI, enlarged identity, and Android keyboard avoidance are present');
