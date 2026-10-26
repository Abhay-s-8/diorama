import test from 'node:test';
import assert from 'node:assert/strict';
import { INK_DARK, INK_LIGHT, contrastRatio, luminance, readableOn } from '../src/color.js';

test('luminance runs from 0 (black) to 1 (white)', () => {
  assert.equal(luminance('#000000'), 0);
  assert.equal(luminance('#ffffff'), 1);
  assert.ok(luminance('#777777') > 0.15 && luminance('#777777') < 0.25);
});

test('contrast ratio is 21 for black on white, 1 for the same colour, and symmetric', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#336699', '#336699'), 1);
  assert.equal(contrastRatio('#123456', '#fedcba'), contrastRatio('#fedcba', '#123456'));
});

test('short or upper-case hex forms are handled the same way', () => {
  assert.equal(luminance('#FFF'), luminance('#ffffff'));
  assert.equal(luminance('#AbCdEf'), luminance('#abcdef'));
});

test('light backgrounds get dark ink and dark backgrounds get light ink', () => {
  assert.equal(readableOn('#dfe3fb'), INK_DARK);
  assert.equal(readableOn('#ffffff'), INK_DARK);
  assert.equal(readableOn('#101820'), INK_LIGHT);
  assert.equal(readableOn('#000000'), INK_LIGHT);
});

test('the ink is always the more readable of the two, and readable enough, on every colour of a coarse grid', () => {
  let worst = Infinity;
  for (let r = 0; r < 256; r += 17) {
    for (let g = 0; g < 256; g += 17) {
      for (let b = 0; b < 256; b += 17) {
        const c = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
        const ink = readableOn(c);
        const other = ink === INK_DARK ? INK_LIGHT : INK_DARK;
        assert.ok(contrastRatio(ink, c) >= contrastRatio(other, c), c);
        worst = Math.min(worst, contrastRatio(ink, c));
      }
    }
  }
  assert.ok(worst >= 4.3, `worst contrast was ${worst}`);
});

test('anything that is not a #rgb or #rrggbb colour is rejected', () => {
  for (const bad of ['red', '#12', '#12345', '#gggggg', '', null, undefined, 42]) {
    assert.throws(() => luminance(bad), TypeError);
  }
});

test('luminance weights the channels the WCAG way: green counts most, blue least', () => {
  const close = (a, b) => Math.abs(a - b) < 1e-4;
  assert.ok(close(luminance('#ff0000'), 0.2126));
  assert.ok(close(luminance('#00ff00'), 0.7152));
  assert.ok(close(luminance('#0000ff'), 0.0722));
});
