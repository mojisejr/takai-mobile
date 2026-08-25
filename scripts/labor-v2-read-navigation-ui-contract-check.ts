import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const main = async (): Promise<void> => {
  const root = process.cwd();
  const app = await readFile(resolve(root, 'src/features/labor-mvp/LaborMvpApp.tsx'), 'utf8');
  const shell = await readFile(resolve(root, 'src/ui/AppShell.tsx'), 'utf8');
  const design = await readFile(resolve(root, 'DESIGN.md'), 'utf8');
  for (const marker of ['WorkDetailScreen', 'WorkFilterSheet', 'FlatList', 'getCalendarMonth', 'getWorkList', 'getTaskDetail', 'งานที่ทำวันนี้', 'ค่าแรงค้างจ่าย']) assert.ok(app.includes(marker), `V2 read navigation needs ${marker}`);
  for (const marker of ['useWindowDimensions', 'calendarCellWidth', "width: calendarCellWidth", 'scrollEnabled={tab !== \'work\'}']) assert.ok(app.includes(marker), `calendar/list layout needs ${marker}`);
  const detailSource = app.slice(app.indexOf('function WorkDetailScreen'), app.indexOf('/** V1 data remains preserved'));
  assert.ok(detailSource.includes('return <FlatList') && detailSource.includes('ListHeaderComponent={<View style={styles.listScreen}>'), 'long Work Detail must own a virtualized vertical scroll surface instead of being clipped by the static work shell');
  assert.ok(shell.includes('scrollEnabled?: boolean') && shell.includes('scrollEnabled ? <ScrollView') && shell.includes('styles.staticContent'), 'AppShell must yield the vertical surface to a full virtualized work list');
  for (const marker of ['งานที่ทำวันนี้', 'ค่าแรงค้างจ่าย', 'รายการงานทั้งหมด']) assert.ok(design.includes(marker), `DESIGN.md must name restored IA: ${marker}`);
  assert.ok(design.includes('V1 history stays preserved') && design.includes('not rendered'), 'DESIGN.md must preserve but hide V1 history during active V2 development');
  assert.ok(!app.includes('ข้อมูลจากระบบเดิม') && !app.includes('ready.adapter.legacyRead'), 'active V2 UI must not render legacy V1 context');
  console.log('LABOR_V2_READ_NAVIGATION_UI_CONTRACT_PASS: capped Today, 7-column calendar, virtualized list/filter, detail, and archived V1 boundary are present');
};
main().catch((error: unknown) => { console.error(error); process.exit(1); });
