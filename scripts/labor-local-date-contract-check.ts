import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localDateKey, localMonthKey } from '../src/date';

const originalTimezone = process.env.TZ;

const inTimezone = (timezone: string, verify: () => void) => {
  process.env.TZ = timezone;
  try {
    verify();
  } finally {
    process.env.TZ = originalTimezone;
  }
};

inTimezone('Asia/Bangkok', () => {
  assert.equal(localDateKey(new Date('2026-08-24T17:30:00.000Z')), '2026-08-25');
  assert.equal(localMonthKey(new Date('2026-08-31T17:30:00.000Z')), '2026-09');
});

inTimezone('Pacific/Kiritimati', () => {
  assert.equal(localDateKey(new Date('2026-08-24T12:30:00.000Z')), '2026-08-25');
  assert.equal(localMonthKey(new Date('2026-08-31T12:30:00.000Z')), '2026-09');
});

inTimezone('Pacific/Pago_Pago', () => {
  assert.equal(localDateKey(new Date('2026-08-25T10:30:00.000Z')), '2026-08-24');
  assert.equal(localMonthKey(new Date('2026-09-01T10:30:00.000Z')), '2026-08');
});

const app = readFileSync('src/features/labor-mvp/LaborMvpApp.tsx', 'utf8');
assert.match(app, /import \{ localDateKey, localMonthKey \} from '\.\.\/\.\.\/date';/);
assert.equal(app.includes('new Date().toISOString().slice(0, 10)'), false);
assert.match(app, /date: localDateKey\(\)/);
assert.match(app, /return localMonthKey\(date\);/);

console.log('labor local-date contract check passed');
