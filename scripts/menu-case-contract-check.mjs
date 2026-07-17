import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const fail = (message) => {
  console.error(`MENU_CASE_CONTRACT_FAIL: ${message}`);
  process.exit(1);
};

const readRequired = (relativePath) => {
  const fullPath = join(root, relativePath);
  if (!existsSync(fullPath)) {
    fail(`missing ${relativePath}`);
  }
  return readFileSync(fullPath, 'utf8');
};

const screen = readRequired('src/features/operations/OperationalSliceScreen.tsx');
const types = readRequired('src/features/operations/types.ts');
const repository = readRequired('src/features/operations/repository.ts');
const webOperations = readRequired('src/features/operations/index.web.ts');
const webData = readRequired('src/data/index.web.ts');

const requiredScreenContracts = [
  "if (tab === 'cases') setView('cases')",
  "if (tab === 'menu') setView('menu')",
  "view === 'menu'",
  'getCaseList(db)',
  'getMenuDashboard(db)',
  'EvidenceTimeline',
  "setSelectedTarget('case')",
  "setView('designLab')",
];

for (const contract of requiredScreenContracts) {
  if (!screen.includes(contract)) {
    fail(`screen missing contract: ${contract}`);
  }
}

if (screen.includes("if (tab === 'menu') setView('designLab')")) {
  fail('bottom menu tab must not route directly to Design Lab');
}

if (!types.includes("'menu'") || !types.includes('MenuDashboard') || !types.includes('CaseListItem')) {
  fail('operation types must expose menu view, menu dashboard, and case list item contracts');
}

if (!repository.includes('export const getCaseList') || !repository.includes('export const getMenuDashboard')) {
  fail('repository must expose case list and menu dashboard read models');
}

if (!webOperations.includes('export const getCaseList') || !webOperations.includes('export const getMenuDashboard')) {
  fail('RN Web preview adapter must expose case list and menu dashboard read models');
}

if (!webData.includes('closedCase: boolean') || !webData.includes('closedCase: false')) {
  fail('RN Web preview db must seed closedCase state for case close proof');
}

console.log('MENU_CASE_CONTRACT_PASS: menu route and case surface contracts are valid');
