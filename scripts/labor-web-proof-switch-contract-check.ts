import assert from 'node:assert/strict';

import { isTakaiLaborProofRequested, selectTakaiWebLaborAdapter } from '../src/data/index.web';
import { selectLaborWebProofScenario, selectLaborWebProofScreen, selectLaborWebProofVisual } from '../src/features/labor-mvp/webProofVisual.web';

const main = async (): Promise<void> => {
  assert.equal(isTakaiLaborProofRequested(''), false, 'default web URL must not enter proof mode');
  assert.equal(isTakaiLaborProofRequested('?proof=0'), false, 'only proof=1 enables proof mode');
  assert.equal(isTakaiLaborProofRequested('?proof=1'), true, 'proof=1 must be an explicit browser entrypoint');
  assert.equal(selectLaborWebProofVisual('?toast=success'), 'none', 'visual fixture must not appear without proof=1');
  assert.equal(selectLaborWebProofVisual('?proof=1&toast=success'), 'success-toast', 'proof URL must expose a non-writing success toast fixture');
  assert.equal(selectLaborWebProofVisual('?proof=1&sheet=confirm'), 'confirm-sheet', 'proof URL must expose a non-writing confirmation sheet fixture');
  assert.equal(selectLaborWebProofScreen('?proof=1&screen=record'), 'record', 'proof record capture must be explicitly addressed');
  assert.equal(selectLaborWebProofScreen('?proof=1&screen=payment'), 'payment', 'proof payment capture must be explicitly addressed');
  assert.equal(selectLaborWebProofScenario('?proof=1&scenario=daily-three-task'), 'daily-three-task', 'proof daily capture must declare its three-task fixture');
  assert.equal(selectLaborWebProofScenario('?proof=1&scenario=open-contract'), 'open-contract', 'proof contract capture must declare its unpriced batch fixture');
  assert.equal(selectLaborWebProofScenario('?proof=1&scenario=payment-selection'), 'payment-selection', 'proof payment capture must declare its selected obligation fixture');
  assert.equal(selectLaborWebProofScenario('?scenario=daily-three-task'), null, 'scenario alone must not affect the normal notebook');

  const normal = selectTakaiWebLaborAdapter('');
  assert.equal(normal.mode, 'notebook', 'default web URL must remain the empty notebook');
  assert.equal((await normal.getReadModel()).tasks.length, 0, 'default web notebook must not seed proof tasks');
  await assert.rejects(normal.commands.startContract({ title: 'ห้ามเขียน', startsOn: '2026-08-02', memberPersonIds: ['worker'] }), /ยังไม่รองรับ/, 'default web writes remain truthful and read-only');

  const proof = selectTakaiWebLaborAdapter('?proof=1');
  assert.equal(proof.mode, 'proof', 'proof URL must select only the existing proof adapter');
  assert.equal(proof.label, 'ข้อมูลทดสอบ', 'proof URL must retain the Thai proof marker');
  assert.equal((await proof.getReadModel()).tasks.length > 0, true, 'proof URL must expose the V2 static fixture');
  await assert.rejects(proof.commands.startContract({ title: 'ห้ามเขียน', startsOn: '2026-08-02', memberPersonIds: ['worker'] }), /ยังไม่รองรับ/, 'proof writes must remain read-only');
  console.log('LABOR_WEB_PROOF_SWITCH_PASS: proof=1 selects the static fixture while the default web notebook remains empty and non-writing');
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
