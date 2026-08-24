import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const phase = 'takai-v2-plot-context';
const sink = join(root, '.oracle-eye', 'rn-web', phase);
const exportDir = join(sink, 'export');
const browserDir = join(sink, 'browser');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const flows = [
  { id: 'record-empty-general', query: '?proof=1&screen=record', expected: 'งานทั่วไป ไม่ระบุแปลง' },
  { id: 'record-multi-plot', query: '?proof=1&screen=record&scenario=plot-multi-target', expected: 'แปลงริมสระ' },
  { id: 'record-quick-add', query: '?proof=1&screen=record&scenario=plot-quick-add', expectedLabel: 'ชื่อแปลงใหม่' },
  { id: 'record-tree-add-remove', query: '?proof=1&screen=record&scenario=plot-multi-target', expected: 'ต้นที่เกี่ยวข้อง (ไม่บังคับ)', treeExercise: true },
  { id: 'plot-archive-history', query: '?proof=1&scenario=plot-archive-history', expected: 'แปลงที่เก็บไว้' },
  { id: 'work-renamed-detail', query: '?proof=1&screen=work&scenario=plot-renamed-detail', expected: 'ชื่อเดิมเมื่อบันทึก: แปลง A' },
];
const viewports = [{ width: 390, height: 844 }, { width: 320, height: 844 }];
const mime = (file) => file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.png') ? 'image/png' : file.endsWith('.ttf') ? 'font/ttf' : 'application/octet-stream';
const relative = (path) => `.oracle-eye/rn-web/${phase}/${path}`;
const fail = (message) => { console.error(`LABOR_V2_PLOT_RN_WEB_EYE_FAIL: ${message}`); process.exitCode = 1; };

if (!existsSync(join(exportDir, 'index.html'))) fail('run TAKAI_RN_WEB_EYE_PHASE=takai-v2-plot-context npm run eye:rn-web first');
if (process.exitCode) process.exit();
mkdirSync(browserDir, { recursive: true });
const server = createServer((request, response) => {
  const raw = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  const requested = raw === '/' ? 'index.html' : raw.replace(/^\/+/, '');
  const file = resolve(exportDir, normalize(requested));
  if (!file.startsWith(resolve(exportDir)) || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); response.end('not found'); return; }
  response.writeHead(200, { 'content-type': mime(file) }); createReadStream(file).pipe(response);
});
const listen = () => new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));

try {
  await listen();
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('local evidence server has no numeric port');
  const targetBaseUrl = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const entries = [];
  const consoleErrors = [];
  const consoleWarnings = [];
  const failedRequests = [];
  for (const viewport of viewports) {
    for (const flow of flows) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errorsBefore = consoleErrors.length; const requestsBefore = failedRequests.length;
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push({ flow: flow.id, viewport: `${viewport.width}x${viewport.height}`, text: message.text() }); if (message.type() === 'warning') consoleWarnings.push({ flow: flow.id, viewport: `${viewport.width}x${viewport.height}`, text: message.text() }); });
      page.on('pageerror', (error) => consoleErrors.push({ flow: flow.id, viewport: `${viewport.width}x${viewport.height}`, text: error.message }));
      page.on('requestfailed', (request) => failedRequests.push({ flow: flow.id, viewport: `${viewport.width}x${viewport.height}`, url: request.url(), failure: request.failure()?.errorText ?? 'requestfailed' }));
      page.on('response', (response) => { if (response.status() >= 400) failedRequests.push({ flow: flow.id, viewport: `${viewport.width}x${viewport.height}`, url: response.url(), failure: `HTTP ${response.status()}` }); });
      const targetUrl = `${targetBaseUrl}/${flow.query}`;
      await page.goto(targetUrl, { waitUntil: 'networkidle' });
      const expected = flow.expectedLabel ? page.getByLabel(flow.expectedLabel).first() : page.getByText(flow.expected, { exact: false }).first();
      await expected.waitFor({ state: 'visible', timeout: 10_000 });
      if (flow.id === 'record-multi-plot') await page.getByText('แปลงริมสระ', { exact: true }).last().scrollIntoViewIfNeeded();
      if (flow.treeExercise) {
        await page.getByText('+ ระบุต้นที่เกี่ยวข้อง', { exact: true }).first().click();
        await page.getByLabel('ต้นที่เกี่ยวข้อง 2').fill('A-015');
        const added = `${flow.id}-added-${viewport.width}x${viewport.height}.png`;
        await page.screenshot({ path: join(browserDir, added), fullPage: true });
        await page.getByText('ลบ', { exact: true }).first().click();
        const removed = `${flow.id}-removed-${viewport.width}x${viewport.height}.png`;
        await page.screenshot({ path: join(browserDir, removed), fullPage: true });
        entries.push({ flow: `${flow.id}:add-remove`, targetUrl, viewport: `${viewport.width}x${viewport.height}`, screenshotPaths: [relative(`browser/${added}`), relative(`browser/${removed}`)], consoleErrorCount: consoleErrors.length - errorsBefore, failedRequestCount: failedRequests.length - requestsBefore, horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth) ? 'detected' : 'none observed' });
      } else {
        const screenshot = `${flow.id}-${viewport.width}x${viewport.height}.png`;
        await page.screenshot({ path: join(browserDir, screenshot), fullPage: true });
        entries.push({ flow: flow.id, targetUrl, viewport: `${viewport.width}x${viewport.height}`, screenshotPaths: [relative(`browser/${screenshot}`)], consoleErrorCount: consoleErrors.length - errorsBefore, failedRequestCount: failedRequests.length - requestsBefore, horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth) ? 'detected' : 'none observed' });
      }
      await context.close();
    }
  }
  await browser.close();
  writeFileSync(join(browserDir, 'console-errors.json'), `${JSON.stringify(consoleErrors, null, 2)}\n`);
  writeFileSync(join(browserDir, 'console-warnings.json'), `${JSON.stringify(consoleWarnings, null, 2)}\n`);
  writeFileSync(join(browserDir, 'network-failures.json'), `${JSON.stringify(failedRequests, null, 2)}\n`);
  const manifestPath = join(sink, 'manifest.json');
  const prior = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const closed = consoleErrors.length === 0 && failedRequests.length === 0 && entries.every((entry) => entry.horizontalOverflow === 'none observed');
  const manifest = {
    ...prior,
    phase,
    lane: 'rn-web-eye',
    claimLabel: closed ? 'RN Web Eye Closed' : 'RN Web Eye Pending',
    targetUrl: targetBaseUrl,
    viewports: viewports.map((viewport) => `${viewport.width}x${viewport.height}`),
    generatedAt: new Date().toISOString(),
    artifacts: { ...prior.artifacts, browserEvidence: relative('browser/browser-evidence.json'), consoleErrors: relative('browser/console-errors.json'), consoleWarnings: relative('browser/console-warnings.json'), networkFailures: relative('browser/network-failures.json') },
    browserEvidence: { screens: entries, consoleErrorCount: consoleErrors.length, failedRequestCount: failedRequests.length, knownWarnings: [...new Set(consoleWarnings.map((warning) => warning.text))], controlPlane: 'Playwright MCP was attempted first; its shared profile was occupied, so this phase-specific harness used an isolated Playwright Chromium context against the same exported artifact.' },
    limitations: ['RN Web is rendered browser evidence only. It does not prove Android touch, physical keyboard avoidance, safe areas, local SQLite persistence, or native packaging.', 'Expo Go Device Eye and Native Eye remain Pending until separately observed.'],
  };
  writeFileSync(join(browserDir, 'browser-evidence.json'), `${JSON.stringify(manifest.browserEvidence, null, 2)}\n`);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  if (!closed) fail(`rendered evidence found errors=${consoleErrors.length}, failedRequests=${failedRequests.length}, or horizontal overflow`);
  console.log(`LABOR_V2_PLOT_RN_WEB_EYE_PASS: ${entries.length} rendered checks at 390x844 and 320x844; evidence=${relative('browser/browser-evidence.json')}`);
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
