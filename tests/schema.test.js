import test from 'node:test';
import assert from 'node:assert/strict';
import { ANIMATIONS, FALLBACK_SCENE, MOODS, SHAPES, validateScene } from '../src/schema.js';

const good = () => ({
  title: 'Desk lamp',
  mood: 'calm',
  palette: { background: '#101820', primary: '#f2aa4c', accent: '#e0e0e0' },
  objects: [
    { shape: 'sphere', color: '#f2aa4c', position: [0, 1, -2], size: 1.2, animation: 'float' },
    { shape: 'box', color: '#112233', position: [-2, 0, 1], size: 0.8, animation: 'spin' },
  ],
  sections: [{ heading: 'Warm light', text: 'Soft and quiet.' }],
});

test('constants list the allowed vocabulary', () => {
  assert.deepEqual(SHAPES, ['box', 'sphere', 'cylinder', 'cone', 'torus']);
  assert.deepEqual(ANIMATIONS, ['none', 'spin', 'float', 'pulse']);
  assert.deepEqual(MOODS, ['calm', 'energetic', 'dark', 'playful', 'elegant']);
});

test('a valid scene passes through unchanged with no warnings', () => {
  const { scene, warnings, fallback } = validateScene(good());
  assert.deepEqual(scene, good());
  assert.deepEqual(warnings, []);
  assert.equal(fallback, false);
});

test('non-objects give the fallback scene', () => {
  for (const bad of [null, undefined, 42, 'text', [], true]) {
    const r = validateScene(bad);
    assert.equal(r.fallback, true);
    assert.deepEqual(r.scene, FALLBACK_SCENE);
    assert.ok(r.warnings.length > 0);
  }
});

test('the fallback scene is itself valid and is returned as a copy', () => {
  const r = validateScene(FALLBACK_SCENE);
  assert.equal(r.fallback, false);
  assert.deepEqual(r.warnings, []);
  const copy = validateScene(null).scene;
  copy.title = 'changed';
  assert.notEqual(FALLBACK_SCENE.title, 'changed');
});

test('title is trimmed, capped at 60 characters and defaulted when missing', () => {
  assert.equal(validateScene({ ...good(), title: '  Hello  ' }).scene.title, 'Hello');
  assert.equal(validateScene({ ...good(), title: 'x'.repeat(100) }).scene.title.length, 60);
  assert.equal(validateScene({ ...good(), title: 7 }).scene.title, 'Untitled scene');
  assert.equal(validateScene({ ...good(), title: '   ' }).scene.title, 'Untitled scene');
});

test('unknown mood becomes calm with a warning', () => {
  const r = validateScene({ ...good(), mood: 'spooky' });
  assert.equal(r.scene.mood, 'calm');
  assert.ok(r.warnings.some((w) => /mood/i.test(w)));
});

test('colours must be #rrggbb; #rgb is expanded; bad ones fall back to the palette', () => {
  const s = good();
  s.palette = { background: '#abc', primary: 'red', accent: '#ABCDEF' };
  const r = validateScene(s);
  assert.equal(r.scene.palette.background, '#aabbcc');
  assert.equal(r.scene.palette.primary, FALLBACK_SCENE.palette.primary);
  assert.equal(r.scene.palette.accent, '#abcdef');
  assert.ok(r.warnings.some((w) => /palette/i.test(w)));
});

test('an object with a bad colour takes the primary palette colour', () => {
  const s = good();
  s.objects[0].color = 'javascript:alert(1)';
  const r = validateScene(s);
  assert.equal(r.scene.objects[0].color, s.palette.primary);
});

test('unknown shapes are dropped with a warning', () => {
  const s = good();
  s.objects.push({ shape: 'dragon', color: '#ffffff', position: [0, 0, 0], size: 1 });
  const r = validateScene(s);
  assert.equal(r.scene.objects.length, 2);
  assert.ok(r.warnings.some((w) => /dragon/.test(w)));
});

test('positions are clamped to -5..5 and sizes to 0.2..3', () => {
  const s = good();
  s.objects[0].position = [99, -99, 5.5];
  s.objects[0].size = 50;
  s.objects[1].size = 0;
  const r = validateScene(s);
  assert.deepEqual(r.scene.objects[0].position, [5, -5, 5]);
  assert.equal(r.scene.objects[0].size, 3);
  assert.equal(r.scene.objects[1].size, 0.2);
});

test('missing or malformed numbers get safe defaults; numeric strings are accepted', () => {
  const s = good();
  s.objects[0].position = [1, 'x'];
  s.objects[0].size = 'big';
  s.objects[1].position = ['1.5', '2', '-3'];
  s.objects[1].size = '2';
  const r = validateScene(s);
  assert.deepEqual(r.scene.objects[0].position, [0, 0, 0]);
  assert.equal(r.scene.objects[0].size, 1);
  assert.deepEqual(r.scene.objects[1].position, [1.5, 2, -3]);
  assert.equal(r.scene.objects[1].size, 2);
});

test('unknown animation becomes none', () => {
  const s = good();
  s.objects[0].animation = 'explode';
  assert.equal(validateScene(s).scene.objects[0].animation, 'none');
  delete s.objects[1].animation;
  assert.equal(validateScene(s).scene.objects[1].animation, 'none');
});

test('more than 12 objects are cut to 12 with a warning', () => {
  const s = good();
  s.objects = Array.from({ length: 20 }, () => ({ ...good().objects[0] }));
  const r = validateScene(s);
  assert.equal(r.scene.objects.length, 12);
  assert.ok(r.warnings.some((w) => /12/.test(w)));
});

test('a scene with no valid objects uses the fallback objects', () => {
  const s = good();
  s.objects = [{ shape: 'nope' }, null, 5];
  const r = validateScene(s);
  assert.deepEqual(r.scene.objects, FALLBACK_SCENE.objects);
  assert.ok(r.warnings.some((w) => /no valid objects/i.test(w)));
  assert.equal(validateScene({ ...good(), objects: 'oops' }).scene.objects.length, FALLBACK_SCENE.objects.length);
});

test('sections are trimmed, capped in length and count, and empties are skipped', () => {
  const s = good();
  s.sections = [
    { heading: '  A  ', text: 'x'.repeat(500) },
    { heading: '', text: '' },
    { heading: 'B' },
    'junk',
    { heading: 'C', text: 'c' },
    { heading: 'D', text: 'd' },
    { heading: 'E', text: 'e' },
  ];
  const r = validateScene(s);
  assert.equal(r.scene.sections.length, 4);
  assert.equal(r.scene.sections[0].heading, 'A');
  assert.equal(r.scene.sections[0].text.length, 240);
  assert.deepEqual(r.scene.sections[1], { heading: 'B', text: '' });
});

test('a missing sections array is fine', () => {
  const s = good();
  delete s.sections;
  assert.deepEqual(validateScene(s).scene.sections, []);
});

test('unknown extra keys are removed and the input is not mutated', () => {
  const s = { ...good(), evil: '<script>', objects: [{ ...good().objects[0], onclick: 'x' }] };
  const before = JSON.stringify(s);
  const r = validateScene(s);
  assert.equal('evil' in r.scene, false);
  assert.equal('onclick' in r.scene.objects[0], false);
  assert.equal(JSON.stringify(s), before);
});
