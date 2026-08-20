import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

const [app, list, feedback, design, eye, webProofVisual, nativeProofVisual, proofQuery] = await Promise.all([
  read('src/features/labor-mvp/LaborMvpApp.tsx'),
  read('src/ui/LedgerListCard.tsx'),
  read('src/ui/LaborFeedback.tsx'),
  read('DESIGN.md'),
  read('scripts/rn-web-eye-check.mjs'),
  read('src/features/labor-mvp/webProofVisual.web.ts'),
  read('src/features/labor-mvp/webProofVisual.native.ts'),
  read('src/features/labor-mvp/webProofVisualQuery.ts'),
]);

for (const required of ['TodayScreen', 'CalendarScreen', 'HistoryScreen', 'JobScreen', 'PersonScreen', 'PeopleScreen', 'LedgerListCard']) {
  assert.ok(app.includes(required), `shared ledger grammar must cover ${required}`);
}
for (const required of ['LedgerListRow', 'LedgerTrailing', 'LedgerRowText', 'ActionEmptyState', 'FeedbackToast', 'FormFeedback', 'ScreenSkeleton', 'TakaiMascot', 'ConfirmActionSheet', 'selectLaborWebProofVisual']) {
  assert.ok(app.includes(required), `Labor UI must apply ${required}`);
}
for (const required of ['borderRadius: tokens.radius.card', "overflow: 'hidden'", 'paddingHorizontal: tokens.spacing.row', 'minWidth: 0', 'minWidth: 80', 'borderBottomWidth: 1']) {
  assert.ok(list.includes(required), `LedgerListCard geometry missing ${required}`);
}
for (const required of ['ConfirmActionSheet', 'FeedbackToast', 'FormFeedback', 'ScreenSkeleton', 'ActionEmptyState', 'TakaiMascot', 'presentationStyle="overFullScreen"']) {
  assert.ok(feedback.includes(required), `feedback primitive missing ${required}`);
}
for (const stale of ['Labor Preview` is visibly labelled', '.oracle-eye/rn-web/labor-calendar-mvp/', '.oracle-eye/rn-static/labor-calendar-mvp/']) {
  assert.equal(design.includes(stale), false, `DESIGN.md must not retain stale proof language/path: ${stale}`);
}
assert.ok(design.includes('.oracle-eye/rn-web/takai-payment-ia/'), 'DESIGN.md must point to the current RN Web evidence sink');
assert.ok(eye.includes("'takai-payment-ia'"), 'RN Web harness default must point to the current evidence sink');
assert.equal(app.includes('styles.laborRow'), false, 'standalone labor bands must be replaced by LedgerListCard rows');
assert.equal(app.includes('styles.personRow'), false, 'standalone people bands must be replaced by LedgerListCard rows');
for (const required of ["params.get('proof') !== '1'", "params.get('toast') === 'success'", "params.get('sheet') === 'confirm'"]) {
  assert.ok(proofQuery.includes(required), `web proof query gate missing ${required}`);
}
assert.ok(webProofVisual.includes('selectLaborWebProofVisualFromSearch'), 'web proof selector must delegate route behavior to the pure query parser');
assert.ok(webProofVisual.includes('window.location?.search'), 'web proof selector must retain browser URL behavior');
assert.ok(nativeProofVisual.includes("=> 'none'"), 'native proof selector must keep normal boot free of proof fixtures');
assert.doesNotMatch(nativeProofVisual, /\b(?:window|location|URLSearchParams)\b/, 'native proof selector must not contain browser globals');
assert.ok(app.includes("from './webProofVisual'"), 'app must retain the extensionless platform boundary import');
console.log('LABOR_LIST_FEEDBACK_CONTRACT_PASS: shared notebook rows, production feedback primitives, mascot restraint, and platform-separated proof routing are aligned');
