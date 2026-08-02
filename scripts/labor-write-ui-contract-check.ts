import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const main = async (): Promise<void> => {
  const root = process.cwd();
  const source = await readFile(resolve(root, 'src/features/labor-mvp/LaborMvpApp.tsx'), 'utf8');
  const adapter = await readFile(resolve(root, 'src/features/labor-mvp/preview.ts'), 'utf8');
  const web = await readFile(resolve(root, 'src/features/labor-mvp/preview.web.ts'), 'utf8');
  for (const required of ['RecordScreen', 'DatePickerField', 'งานรายชิ้นเป็นชุด', 'งานเหมา', 'เต็มวัน', 'ครึ่งวัน', 'จำนวนนาที', 'จ่ายค่าแรงรายคน', 'รับเงินชุดงาน', 'ให้เงินเบิก', 'หักคืนเงินเบิก', 'เหตุผลที่แก้ไข', 'บันทึกสำเร็จแล้ว และรีเฟรชปฏิทิน/ประวัติเรียบร้อย']) {
    assert.ok(source.includes(required), `Labor write UI must expose ${required}`);
  }
  for (const command of ['createNormalWork', 'createGroupPieceWork', 'createLaborContract', 'addLaborContractProgress', 'completeLaborContractWork', 'postLaborPayment', 'postLaborSettlementGroupReceipt', 'createLaborWorkerAdvance', 'applyLaborAdvanceDeduction', 'editLaborPayment', 'editLaborSettlementGroupReceipt', 'editLaborWorkerAdvance']) {
    assert.ok(adapter.includes(command), `native adapter must route ${command} to repository truth`);
    assert.ok(web.includes(command), `web adapter must explicitly cover ${command}`);
  }
  assert.ok(web.includes('โหมดอ่านอย่างเดียว'), 'web writes must fail honestly rather than append false history');
  assert.ok(!source.includes('generic fractional'), 'UI must not expose generic fractional-day semantics');
  console.log('LABOR_WRITE_UI_CONTRACT_PASS: typed write routes, person-only advance recovery, reasoned revisions, and honest web failure are present');
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
