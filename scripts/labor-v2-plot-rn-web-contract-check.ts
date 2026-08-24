import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { selectLaborWebProofScenario } from '../src/features/labor-mvp/webProofVisual.web';

const read = (path: string) => readFile(resolve(process.cwd(), path), 'utf8');

const main = async (): Promise<void> => {
  const [editor, app, management, fixture, webEye] = await Promise.all([
    read('src/features/labor-mvp/LaborRecordGroupEditor.tsx'),
    read('src/features/labor-mvp/LaborMvpApp.tsx'),
    read('src/features/labor-mvp/PlotManagement.tsx'),
    read('src/features/labor-mvp/previewV2.web.fixture.ts'),
    read('scripts/rn-web-eye-check.mjs'),
  ]);
  for (const scenario of ['plot-multi-target', 'plot-quick-add', 'plot-renamed-detail', 'plot-archive-history']) {
    assert.equal(selectLaborWebProofScenario(`?proof=1&scenario=${scenario}`), scenario, `${scenario} must remain explicit proof-only route state`);
  }
  assert.equal(selectLaborWebProofScenario('?scenario=plot-multi-target'), null, 'normal web notebook cannot seed proof state');
  for (const marker of ['proof-plots', 'labor-v2-preview-plot-north', 'labor-v2-preview-plot-pond', 'แปลงใหม่ทดสอบ', 'ต้นที่เกี่ยวข้อง (ไม่บังคับ)']) assert.ok(editor.includes(marker), `capture proof must include ${marker}`);
  assert.ok(app.includes('plot-renamed-detail') && app.includes('plot-archive-history') && app.includes('initialPlotId'), 'app must wire renamed and archived proof surfaces route-locally');
  assert.ok(management.includes('initialPlotId') && management.includes('แปลงที่เก็บไว้'), 'plot archive proof must render the real detail surface');
  assert.ok(fixture.includes('labor-v2-preview-plot-pond') && fixture.includes('แปลงริมสระ'), 'generated fixture must provide two active plots for multi-select proof');
  assert.ok(webEye.includes("'.oracle-eye', 'rn-web', phase"), 'browser export must remain in the phase artifact sink');
  console.log('LABOR_V2_PLOT_RN_WEB_CONTRACT_PASS: explicit read-only browser proof states cover multi-plot, quick-add sheet, tree rows, renamed detail, and archived history');
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
