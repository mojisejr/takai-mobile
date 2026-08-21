import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const main = async (): Promise<void> => {
  const root = process.cwd();
  const source = await readFile(resolve(root, 'src/features/labor-mvp/LaborMvpApp.tsx'), 'utf8');
  const record = await readFile(resolve(root, 'src/features/labor-mvp/LaborRecordGroupEditor.tsx'), 'utf8');
  const shell = await readFile(resolve(root, 'src/ui/AppShell.tsx'), 'utf8');
  const adapter = await readFile(resolve(root, 'src/features/labor-mvp/previewV2Adapter.ts'), 'utf8');
  const web = await readFile(resolve(root, 'src/features/labor-mvp/previewV2.web.ts'), 'utf8');
  for (const required of ['RecordScreen', 'DatePickerField', 'TaskListEditor', 'units', 'recordDay', 'startContract', 'งานเหมา', 'รายวัน', 'รายชั่วโมง', 'OpenContractCard', 'บันทึกความคืบหน้า', 'ปิดงานเหมาสร้างก้อนรับเงิน', 'PaymentScreen', 'จ่ายค่าแรง', 'เลือกเงินเบิกของคนนี้', 'บันทึกเงินเบิก', 'ยืนยันการจ่ายเงิน']) {
    assert.ok(source.includes(required), `Labor write UI must expose ${required}`);
  }
  for (const command of ['recordLaborDayV2', 'startLaborContractBatchV2', 'recordLaborContractProgressV2', 'finalizeLaborContractBatchV2', 'createLaborV2PersonAdvance', 'listLaborV2PersonAdvances', 'postLaborV2PaymentSession', 'correctLaborV2PaymentSession']) {
    assert.ok(adapter.includes(command), `native adapter must route ${command} to repository truth`);
  }
  for (const command of ['recordDay', 'startContract', 'progressContract', 'finalizeContract', 'issueAdvance', 'listAdvances', 'postPayment', 'correctPayment']) assert.ok(web.includes(command), `web adapter must explicitly cover ${command}`);
  assert.ok(web.includes('ยังไม่รองรับ'), 'web writes must fail honestly rather than append false history');
  for (const required of ['LaborRecordGroupEditor', 'วันที่ทำงาน', 'คนที่มาทำงาน', 'ชุดคนที่มาทำงาน', 'งานที่ทำวันนี้', '+ เพิ่มงาน', 'คิดค่าแรงแบบ', 'ค่าแรงรายวัน', 'ค่าแรงรายชั่วโมง', 'งานเหมา', 'rateBaht', 'StickySaveBar', 'recordDay', 'startContract']) assert.ok(record.includes(required), `person/team-first record must expose ${required}`);
  for (const banned of ['หน่วยค่าตอบแทน', 'Task ที่ทำ', '35_000', '12_000', 'obligation']) assert.ok(!record.includes(banned), `visible record source must not expose ${banned}`);
  assert.ok(shell.includes('keyboardAware') && shell.includes('keyboardDidShow') && shell.includes('keyboardShouldPersistTaps'), 'shared app shell must provide keyboard-safe form behavior');
  assert.ok(!source.includes('generic fractional'), 'UI must not expose generic fractional-day semantics');
  console.log('LABOR_WRITE_UI_CONTRACT_PASS: person/team-first V2 write routes, explicit rates, and keyboard-safe form surface are present');
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
