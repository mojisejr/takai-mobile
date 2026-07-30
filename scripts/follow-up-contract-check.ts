import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  followUpDaysRemaining,
  followUpDueState,
  formatFollowUpDueLabel,
  resolveFollowUpOn,
} from '../src/features/operations';

const main = async (): Promise<void> => {
  const baseDate = '2026-07-16T23:30:00+07:00';
  const direct = resolveFollowUpOn({ mode: 'date', baseDate, directDate: '2026-07-20' });
  const offset = resolveFollowUpOn({ mode: 'days', baseDate, days: 4 });
  assert.equal(direct, '2026-07-20', 'direct calendar date is preserved as the canonical day');
  assert.equal(offset, direct, 'direct date and N-day entry resolve to the same canonical due day');
  assert.equal(resolveFollowUpOn({ mode: 'days', baseDate: '2026-07-16T00:30:00+07:00', days: 1 }), '2026-07-17', 'date-only resolution is stable at a Bangkok timezone boundary');
  assert.equal(resolveFollowUpOn({ mode: 'date', baseDate, directDate: '' }), null, 'blank direct date means no follow-up');
  assert.equal(resolveFollowUpOn({ mode: 'days', baseDate, days: 0 }), null, 'zero days means no follow-up');
  assert.equal(followUpDueState('2026-07-16', '2026-07-16T08:30:00+07:00'), 'due_today');
  assert.equal(followUpDueState('2026-07-15', '2026-07-16T08:30:00+07:00'), 'overdue');
  assert.equal(followUpDueState(null, '2026-07-16T08:30:00+07:00'), 'none');
  assert.equal(followUpDaysRemaining('2026-07-20', '2026-07-16T08:30:00+07:00'), 4);
  assert.equal(formatFollowUpDueLabel('2026-07-15', '2026-07-16T08:30:00+07:00'), 'เกินกำหนด 1 วัน');

  const repository = await readFile(resolve(process.cwd(), 'src/features/operations/repository.ts'), 'utf8');
  const screen = await readFile(resolve(process.cwd(), 'src/features/operations/OperationalSliceScreen.tsx'), 'utf8');
  const fieldForm = await readFile(resolve(process.cwd(), 'src/ui/FieldForm.tsx'), 'utf8');
  assert.ok(repository.includes('const nextDue = row.latest_follow_up_on;'), 'Tracker must not invent a due date from performed_at');
  assert.ok(repository.includes('formatFollowUpDueLabel(row.follow_up_on)'), 'Today must present due state from follow_up_on');
  assert.ok(screen.includes('เลือกวันโดยตรง') && screen.includes('DatePickerField') && fieldForm.includes('DateTimePicker') && screen.includes('resolveFollowUpOn'), 'Activity UI must offer a native calendar and N-day resolution before save');
  console.log('FOLLOW_UP_CONTRACT_PASS: canonical resolution, timezone-safe due state, Today/Tracker source, and optional null follow-up are valid');
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
