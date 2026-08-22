import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const source = readFileSync(join(root, 'src/features/labor-mvp/LaborMvpApp.tsx'), 'utf8');
const fail = (message) => { console.error(`WARM_NOTEBOOK_READ_MONEY_FAIL: ${message}`); process.exit(1); };

for (const marker of ['TodayScreen', 'allTasks.slice(0, 5)', 'allUnpaid.slice(0, 5)', 'heroCard', 'GardenAccent', 'AmountSummary', 'งานที่ทำวันนี้', 'ค่าแรงค้างจ่าย']) if (!source.includes(marker)) fail(`Today reference screen missing ${marker}`);
for (const marker of ['WorkScreen', 'FlatList', 'calendarCellWidth', 'width: calendarCellWidth', 'WorkFilterSheet', 'presentationStyle="overFullScreen"']) if (!source.includes(marker)) fail(`Work calendar/history boundary missing ${marker}`);
for (const marker of ['PaymentScreen', 'ชุดรับเงิน · ก้อนเดียวของชุดงาน', 'ไม่แยกยอดเป็นค่าแรงของสมาชิก', 'โบนัสไม่เพิ่มสิทธิ์หักเงินเบิก', 'advanceRecoveries']) if (!source.includes(marker)) fail(`Payment must preserve group and person-only advance language: ${marker}`);
for (const marker of ['PeopleScreen', 'PersonDetailScreen', 'showArchived', 'รายชื่อที่เก็บไว้', 'เงินเบิกคงเหลือ']) if (!source.includes(marker)) fail(`People active/archive history missing ${marker}`);
if (source.includes("from '../../data/schema'") || source.includes("from './repositoryV2'")) fail('read/money visual phase must not reach into schema or repository commands');
console.log('WARM_NOTEBOOK_READ_MONEY_PASS: capped Today, calendar/history, group-safe payment, people archive history, and presentation-only boundaries are present');
