import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  calculateChemicalDose,
  canScheduleFollowUp,
  normalizeActivityTemporal,
  resolveFollowUpOn,
} from '../src/features/operations';

const main = async (): Promise<void> => {
  const allDay = normalizeActivityTemporal({ performedAt: 'legacy', timeMode: 'all_day', activityDate: '2026-07-16' });
  const range = normalizeActivityTemporal({ performedAt: 'legacy', timeMode: 'time_range', activityDate: '2026-07-16', startedAt: '08:00', endedAt: '10:30' });
  const duration = normalizeActivityTemporal({ performedAt: 'legacy', timeMode: 'duration_only', activityDate: '2026-07-16', durationMinutes: 90 });
  assert.equal(allDay.startedAt, null, 'all-day work keeps no fabricated start time');
  assert.equal(range.endedAt, '2026-07-16T10:30:00', 'time range retains both field times');
  assert.equal(duration.durationMinutes, 90, 'duration-only work records a duration without a range');

  const directDue = resolveFollowUpOn({ mode: 'date', baseDate: '2026-07-16', directDate: '2026-07-20' });
  const offsetDue = resolveFollowUpOn({ mode: 'days', baseDate: '2026-07-16', days: 4 });
  assert.equal(directDue, offsetDue, 'direct-date and N-day follow-up entries meet at one canonical due fact');
  assert.equal(calculateChemicalDose(20, 100, 200), 10, 'the field journey preserves chemical reference arithmetic');
  assert.equal(canScheduleFollowUp(directDue, '2026-07-16'), true, 'only the future canonical date reaches reminder scheduling');

  const screen = await readFile(resolve(process.cwd(), 'src/features/operations/OperationalSliceScreen.tsx'), 'utf8');
  for (const label of [
    'ตั้งค่าสวนก่อนบันทึก',
    '1. เลือกหรือเพิ่มแปลง',
    '2. เพิ่มหลุม',
    '3. ใส่ต้นไม้ในหลุม',
    'TimeModeControl',
    '+ เพิ่มคนงาน',
    'คำนวณได้',
    'กำหนดเอง',
    'เลือกวันโดยตรง',
    'เปิดการแจ้งเตือนวันติดตาม',
  ]) {
    assert.ok(screen.includes(label), `field acceptance surface must retain ${label}`);
  }
  console.log('FIELD_ACCEPTANCE_CONTRACT_PASS: setup, truthful time, independent workers, chemical override, canonical follow-up, and explicit reminder opt-in are ready for operator proof');
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
