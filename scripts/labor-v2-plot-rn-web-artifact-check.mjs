import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const sink = '.oracle-eye/rn-web/takai-v2-plot-context';
const fail = (message) => { console.error(`LABOR_V2_PLOT_RN_WEB_ARTIFACT_FAIL: ${message}`); process.exit(1); };
const read = (path) => { const full = join(root, path); if (!existsSync(full)) fail(`missing ${path}`); return readFileSync(full, 'utf8'); };
const manifest = JSON.parse(read(`${sink}/manifest.json`));

if (manifest.lane !== 'rn-web-eye' || manifest.claimLabel !== 'RN Web Eye Closed') fail('rendered browser lane must be explicitly closed');
if (JSON.stringify(manifest.viewports) !== JSON.stringify(['390x844', '320x844'])) fail('rendered proof must record both phone viewports');
if (manifest.browserEvidence?.consoleErrorCount !== 0 || manifest.browserEvidence?.failedRequestCount !== 0) fail('rendered proof requires zero console errors and failed requests');
const expected = ['record-empty-general', 'record-multi-plot', 'record-quick-add', 'record-tree-add-remove:add-remove', 'plot-archive-history', 'work-renamed-detail'];
const screens = manifest.browserEvidence?.screens ?? [];
if (screens.length !== expected.length * 2) fail('proof must include every named flow at both viewports');
for (const viewport of ['390x844', '320x844']) for (const flow of expected) {
  const screen = screens.find((entry) => entry.flow === flow && entry.viewport === viewport);
  if (!screen || screen.horizontalOverflow !== 'none observed' || screen.consoleErrorCount !== 0 || screen.failedRequestCount !== 0) fail(`${flow} at ${viewport} must remain clean`);
  if (!Array.isArray(screen.screenshotPaths) || !screen.screenshotPaths.length) fail(`${flow} at ${viewport} needs a screenshot`);
  for (const screenshot of screen.screenshotPaths) read(screenshot);
}
for (const artifact of ['browserEvidence', 'consoleErrors', 'consoleWarnings', 'networkFailures']) read(manifest.artifacts?.[artifact]);
console.log('LABOR_V2_PLOT_RN_WEB_ARTIFACT_PASS: rendered 390/320 evidence covers capture, picker, tree, archive, and renamed detail with clean browser diagnostics');
