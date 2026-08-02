import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';

const root = process.cwd();
const SOURCE_HASH = '28eaa33708ea8c8ae6ecc29cd76a5ec92b79dac0a34c07e611d339fb59682d90';
const assets = {
  icon: { path: 'assets/icon.png', width: 1024, height: 1024, colorType: 2, hash: '2bb654b09fb31c12c5f9de968232bb0413711b009264fb99b6b2c42df2b2e862' },
  foreground: { path: 'assets/android-icon-foreground.png', width: 1024, height: 1024, colorType: 6, hash: '37250e31f69829ce227b33e895973e515eb6ee902d8ff48f9317eadaa3b619f3' },
  background: { path: 'assets/android-icon-background.png', width: 1024, height: 1024, colorType: 2, hash: '069d3f5ba53a07d8ef2f04947e86566047fcb210de1c62c9caf4fe6d70ffaba9' },
  monochrome: { path: 'assets/android-icon-monochrome.png', width: 1024, height: 1024, colorType: 6, hash: 'c815b1c323e778be837c2b77c98d8f3f1ce8db5d9518d9e4ca5bfa40e1ef8b79' },
  splash: { path: 'assets/splash-icon.png', width: 1024, height: 1024, colorType: 6, hash: '103afd0c399e7658955455be2a874e2a5f83273f3cc48d032d5f153146174857' },
  favicon: { path: 'assets/favicon.png', width: 48, height: 48, colorType: 6, hash: 'f9116f0e0d6d5ceb75c3dff003bc66f963960162dc5534dfb9e2b2726b9d1b05' },
  bust: { path: 'assets/brand/takai-mascot-bust.png', width: 256, height: 256, colorType: 6, hash: 'de85219586c32cce7e0a3f389fbbfe13d4e4cab36eaadab935771ebdf503b625' },
};

const png = (relativePath) => {
  const bytes = readFileSync(join(root, relativePath));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${relativePath} must be PNG`);
  let offset = 8; let header; const compressed = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset); const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + length); offset += length + 12;
    if (type === 'IHDR') header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9], interlace: data[12] };
    if (type === 'IDAT') compressed.push(data);
  }
  assert.ok(header, `${relativePath} must include IHDR`);
  assert.equal(header.bitDepth, 8, `${relativePath} must be 8-bit`);
  assert.equal(header.interlace, 0, `${relativePath} must be non-interlaced for deterministic inspection`);
  return { ...header, raw: inflateSync(Buffer.concat(compressed)) };
};

const unfilter = ({ width, height, colorType, raw }) => {
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel; const output = Buffer.alloc(stride * height); let source = 0;
  const paeth = (left, up, upLeft) => { const p = left + up - upLeft; const a = Math.abs(p - left); const b = Math.abs(p - up); const c = Math.abs(p - upLeft); return a <= b && a <= c ? left : b <= c ? up : upLeft; };
  for (let row = 0; row < height; row += 1) {
    const filter = raw[source++]; const rowStart = row * stride;
    for (let column = 0; column < stride; column += 1) {
      const value = raw[source++]; const left = column >= bytesPerPixel ? output[rowStart + column - bytesPerPixel] : 0;
      const up = row ? output[rowStart - stride + column] : 0; const upLeft = row && column >= bytesPerPixel ? output[rowStart - stride + column - bytesPerPixel] : 0;
      output[rowStart + column] = filter === 0 ? value : filter === 1 ? (value + left) & 255 : filter === 2 ? (value + up) & 255 : filter === 3 ? (value + Math.floor((left + up) / 2)) & 255 : filter === 4 ? (value + paeth(left, up, upLeft)) & 255 : (() => { throw new Error(`unsupported PNG filter ${filter}`); })();
    }
  }
  return { bytes: output, bytesPerPixel };
};

for (const [name, expected] of Object.entries(assets)) {
  assert.ok(existsSync(join(root, expected.path)), `${name} derivative must exist`);
  const bytes = readFileSync(join(root, expected.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.hash, `${name} derivative must be reviewed`);
  const decoded = png(expected.path);
  assert.deepEqual([decoded.width, decoded.height, decoded.colorType], [expected.width, expected.height, expected.colorType], `${name} geometry/alpha role must match`);
}
assert.equal(createHash('sha256').update(readFileSync(join(root, 'assets/brand/takai-mascot.png'))).digest('hex'), SOURCE_HASH, 'canonical mascot must remain unchanged');

const foreground = unfilter(png(assets.foreground.path));
const alphaValues = [];
for (let index = 3; index < foreground.bytes.length; index += foreground.bytesPerPixel) alphaValues.push(foreground.bytes[index]);
assert.ok(alphaValues.includes(0) && alphaValues.includes(255), 'adaptive foreground must contain transparent margin and opaque mascot pixels');

const monochrome = unfilter(png(assets.monochrome.path));
for (let index = 0; index < monochrome.bytes.length; index += monochrome.bytesPerPixel) {
  if (monochrome.bytes[index + 3] !== 0) assert.deepEqual([...monochrome.bytes.subarray(index, index + 3)], [31, 45, 31], 'monochrome icon must contain a single ink color');
}

const background = unfilter(png(assets.background.path));
for (let index = 0; index < background.bytes.length; index += background.bytesPerPixel) assert.deepEqual([...background.bytes.subarray(index, index + 3)], [244, 233, 216], 'adaptive background must be warm sand');

const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
assert.equal(app.icon, './assets/icon.png');
assert.deepEqual(app.android.adaptiveIcon, { backgroundColor: '#F4E9D8', foregroundImage: './assets/android-icon-foreground.png', backgroundImage: './assets/android-icon-background.png', monochromeImage: './assets/android-icon-monochrome.png' });
assert.equal(app.web.favicon, './assets/favicon.png');
assert.equal(app.android.package, 'com.nonthasak.takai', 'package identity must remain unchanged');
assert.equal(app.extra.eas.projectId, '1506fb8d-5e0c-47b0-ab26-5d7ca80e89d2', 'EAS identity must remain unchanged');
const splashPlugin = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');
assert.deepEqual(splashPlugin, ['expo-splash-screen', { image: './assets/splash-icon.png', resizeMode: 'contain', backgroundColor: '#F4E9D8', imageWidth: 180 }]);

console.log('TAKAI_BRAND_ASSET_CONTRACT_PASS: immutable mascot source, reviewed derivatives, adaptive geometry, splash, favicon, and Expo identities are valid');
