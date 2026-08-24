import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const main = async (): Promise<void> => {
  const root = process.cwd();
  const app = await readFile(resolve(root, 'src/features/labor-mvp/LaborMvpApp.tsx'), 'utf8');
  const fields = await readFile(resolve(root, 'src/ui/FieldForm.tsx'), 'utf8');
  const adapter = await readFile(resolve(root, 'src/features/labor-mvp/previewV2Adapter.ts'), 'utf8');

  for (const marker of ['PaymentScreen', 'getPaymentBatchDraft', 'selectedIds', 'เลือกค่าแรงค้างจ่าย', 'ตรวจรายการที่เลือก', 'เงินสดที่จ่าย', 'postPayment', 'settlements: selected.map', 'missingAdvance', 'DatePickerField', 'ConfirmActionSheet']) {
    assert.ok(app.includes(marker), `batch payment UI must preserve ${marker}`);
  }
  for (const marker of ['PaymentSettlementRow', 'จ่ายค่าแรง (บาท)', 'เงินเพิ่ม (บาท)', 'หักเงินเบิก (บาท)', 'ชุดรับเงินจ่ายเป็นก้อนเดียว จึงไม่มีการหักเงินเบิก']) {
    assert.ok(app.includes(marker), `settlement row must preserve ${marker}`);
  }
  for (const marker of ['PersonDetailScreen', 'ให้เงินเบิก', 'AdvanceIssueSheet', 'issueAdvance', 'วันที่ให้เงินเบิก', 'จำนวนเงินเบิก (บาท)', 'ยืนยันให้เงินเบิก']) {
    assert.ok(app.includes(marker), `person advance UI must preserve ${marker}`);
  }
  assert.ok(!app.includes('ออกเงินเบิกให้ {personName'), 'payment composer must not issue an advance from a selected wage obligation');
  assert.ok(fields.includes('selectionLabel') && fields.includes("selectionLabel = 'คน'"), 'shared multi-select sheet must label a payment selection as items rather than people');
  assert.ok(fields.includes('presentationStyle="overFullScreen"'), 'payment picker sheets must use supported transparent presentation');
  assert.ok(adapter.includes('getPaymentBatchDraft') && adapter.includes('issueAdvance'), 'V2 adapter remains the only batch/advance UI boundary');
  console.log('LABOR_PAYMENT_BATCH_UI_CONTRACT_PASS: multi-select V2 batch payment, group-safe recovery rows, and standalone person advance sheet are wired');
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
