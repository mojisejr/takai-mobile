import assert from 'node:assert/strict';

import { isTakaiLaborProofRequested, selectTakaiWebLaborAdapter } from '../src/data/index.web';
import { selectLaborWebProofVisual } from '../src/features/labor-mvp/webProofVisual.web';

const main = async (): Promise<void> => {
  assert.equal(isTakaiLaborProofRequested(''), false, 'default web URL must not enter proof mode');
  assert.equal(isTakaiLaborProofRequested('?proof=0'), false, 'only proof=1 enables proof mode');
  assert.equal(isTakaiLaborProofRequested('?proof=1'), true, 'proof=1 must be an explicit browser entrypoint');
  assert.equal(selectLaborWebProofVisual('?toast=success'), 'none', 'visual fixture must not appear without proof=1');
  assert.equal(selectLaborWebProofVisual('?proof=1&toast=success'), 'success-toast', 'proof URL must expose a non-writing success toast fixture');
  assert.equal(selectLaborWebProofVisual('?proof=1&sheet=confirm'), 'confirm-sheet', 'proof URL must expose a non-writing confirmation sheet fixture');

  const normal = selectTakaiWebLaborAdapter('');
  assert.equal(normal.mode, 'notebook', 'default web URL must remain the empty notebook');
  assert.equal((await normal.getReadModel()).people.length, 0, 'default web notebook must not seed proof people');
  await assert.rejects(normal.commands.createLaborContract({ title: 'ห้ามเขียน', workDate: '2026-08-02', participants: [] }), /ยังไม่รองรับ/, 'default web writes remain truthful and read-only');

  const proof = selectTakaiWebLaborAdapter('?proof=1');
  assert.equal(proof.mode, 'proof', 'proof URL must select only the existing proof adapter');
  assert.equal(proof.label, 'ข้อมูลทดสอบ', 'proof URL must retain the Thai proof marker');
  assert.equal((await proof.getReadModel()).people.length > 0, true, 'proof URL must expose the existing static fixture');
  await assert.rejects(proof.commands.createLaborContract({ title: 'ห้ามเขียน', workDate: '2026-08-02', participants: [] }), /อ่านอย่างเดียว/, 'proof writes must remain read-only');
  console.log('LABOR_WEB_PROOF_SWITCH_PASS: proof=1 selects the static fixture while the default web notebook remains empty and non-writing');
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
