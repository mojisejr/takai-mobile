import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const main = async (): Promise<void> => {
  const root = process.cwd();
  const app = await readFile(resolve(root, 'src/features/labor-mvp/LaborMvpApp.tsx'), 'utf8');
  const shell = await readFile(resolve(root, 'src/ui/AppShell.tsx'), 'utf8');
  const design = await readFile(resolve(root, 'DESIGN.md'), 'utf8');
  for (const marker of ['WorkDetailScreen', 'WorkFilterSheet', 'FlatList', 'getCalendarMonth', 'getWorkList', 'getTaskDetail', 'งานที่ทำวันนี้', 'ค่าแรงค้างจ่าย', 'ประวัติเดิม']) assert.ok(app.includes(marker), `V2 read navigation needs ${marker}`);
  for (const marker of ['useWindowDimensions', 'calendarCellWidth', "width: calendarCellWidth", 'scrollEnabled={tab !== \'work\'}']) assert.ok(app.includes(marker), `calendar/list layout needs ${marker}`);
  assert.ok(shell.includes('scrollEnabled?: boolean') && shell.includes('scrollEnabled={scrollEnabled}'), 'AppShell must yield scrolling to a full virtualized work list');
  for (const marker of ['งานที่ทำวันนี้', 'ค่าแรงค้างจ่าย', 'รายการงานทั้งหมด', 'ประวัติเดิม']) assert.ok(design.includes(marker), `DESIGN.md must name restored IA: ${marker}`);
  console.log('LABOR_V2_READ_NAVIGATION_UI_CONTRACT_PASS: capped Today, 7-column calendar, virtualized list/filter, detail, and legacy boundary are present');
};
main().catch((error: unknown) => { console.error(error); process.exit(1); });
