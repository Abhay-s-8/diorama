import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateScene } from '../src/schema.js';

const demo = JSON.parse(fs.readFileSync(new URL('../examples/demo-scene.json', import.meta.url), 'utf8'));

test('the demo scene is valid as written: nothing is dropped, clamped or replaced', () => {
  const { scene, warnings, fallback } = validateScene(demo);
  assert.equal(fallback, false);
  assert.deepEqual(warnings, []);
  assert.deepEqual(scene, demo);
});

test('the demo scene has several shapes and at least one animated shape', () => {
  assert.ok(demo.objects.length >= 4);
  assert.ok(demo.objects.some((o) => o.animation !== 'none'));
});

test('the demo scene keeps its shapes apart so none hides another', () => {
  const o = demo.objects;
  for (let i = 0; i < o.length; i++) {
    for (let j = i + 1; j < o.length; j++) {
      const d = Math.hypot(...o[i].position.map((v, k) => v - o[j].position[k]));
      if (o[i].shape === 'torus' || o[j].shape === 'torus') continue; // a ring may circle a shape
      assert.ok(d > (o[i].size + o[j].size) / 2, `${o[i].shape} and ${o[j].shape} overlap`);
    }
  }
});
