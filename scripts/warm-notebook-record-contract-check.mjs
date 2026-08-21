import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), 'utf8');
const fail = (message) => { console.error(`WARM_NOTEBOOK_RECORD_FAIL: ${message}`); process.exit(1); };

const record = read('src/features/labor-mvp/LaborRecordGroupEditor.tsx');
for (const marker of ['SearchPickerSheet', 'methodPickerGroup', 'เลือกวิธีคิดค่าแรง', 'ช่วงเวลาทำงาน', 'dayPartPickerGroup', 'hourlyJob', 'StickySaveBar', 'ไม่มีค่าแรงสำหรับชุดงานนี้', 'recordDay', 'startContract']) if (!record.includes(marker)) fail(`record ergonomics missing ${marker}`);
if (record.includes('styles.methodRow') || record.includes('styles.methodSelected')) fail('wage-method segmented pills must be replaced by the picker sheet');
for (const marker of ['presentationStyle="overFullScreen"', 'keyboardDidShow', 'keyboardShouldPersistTaps']) {
  const source = marker.includes('keyboard') ? read('src/ui/AppShell.tsx') : read('src/ui/FieldForm.tsx');
  if (!source.includes(marker)) fail(`Android-safe form primitive missing ${marker}`);
}

const sink = '.oracle-eye/expo-go/takai-warm-notebook-ui-redesign';
if (!existsSync(join(root, sink, 'README.md')) || !existsSync(join(root, sink, 'operator-evidence.json'))) fail('missing warm notebook Expo Go operator card');
const card = read(`${sink}/README.md`);
const evidence = JSON.parse(read(`${sink}/operator-evidence.json`));
for (const id of ['record-person-team-first', 'record-wage-method-sheet', 'record-daily-full-half-picker', 'record-hourly-vertical-fields', 'record-long-form-keyboard', 'read-money-notebook-consistency']) if (!card.includes(id) || !evidence.scenarios.some((item) => item.id === id && item.status === 'not_run')) fail(`operator card must keep ${id} pending`);
if (evidence.status !== 'pending_operator' || evidence.claimLabel !== 'Expo Go Device Eye Pending' || evidence.capturedAt !== null || evidence.operatorAcceptance?.accepted !== null) fail('operator card must not fabricate Android acceptance');
console.log('WARM_NOTEBOOK_RECORD_PASS: picker-based method flow, compact daily choice, vertical hourly rows, keyboard-safe save, and honest Expo Go card are present');
