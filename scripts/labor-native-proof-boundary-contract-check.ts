import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { selectLaborWebProofVisual } from '../src/features/labor-mvp/webProofVisual.native';

type GlobalWithWindow = Record<string, unknown>;

const queryRoutes = ['', '?proof=1', '?proof=1&toast=success', '?proof=1&sheet=confirm'];
const runtime = globalThis as unknown as GlobalWithWindow;

const main = async (): Promise<void> => {
  const nativeSource = await readFile(resolve(process.cwd(), 'src/features/labor-mvp/webProofVisual.native.ts'), 'utf8');
  assert.doesNotMatch(nativeSource, /\b(?:window|location|URLSearchParams)\b/, 'native proof selector must not reference browser globals');

  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    for (const search of queryRoutes) {
      runtime.window = { location: { search } };
      assert.doesNotThrow(() => selectLaborWebProofVisual(), `native selector must ignore ${search || 'the empty query'}`);
      assert.equal(selectLaborWebProofVisual(), 'none', `native selector must not render a proof fixture for ${search || 'the empty query'}`);
    }

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      get: () => { throw new Error('native proof selector must not inspect window'); },
    });
    assert.doesNotThrow(() => selectLaborWebProofVisual(), 'native selector must remain safe when React Native exposes an incomplete window global');
    assert.equal(selectLaborWebProofVisual(), 'none', 'native selector must return no proof visual during normal boot');
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete runtime.window;
  }

  console.log('LABOR_NATIVE_PROOF_BOUNDARY_PASS: native boot ignores all web proof routes without reading browser globals');
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
