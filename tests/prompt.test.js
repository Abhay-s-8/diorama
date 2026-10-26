import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENE_JSON_SCHEMA, buildPrompt } from '../src/prompt.js';
import { ANIMATIONS, MOODS, SHAPES } from '../src/schema.js';

test('the prompt lists every allowed shape, animation and mood', () => {
  const p = buildPrompt();
  for (const word of [...SHAPES, ...ANIMATIONS, ...MOODS]) assert.ok(p.includes(word), word);
});

test('the prompt demands JSON only', () => {
  assert.match(buildPrompt(), /only/i);
  assert.match(buildPrompt(), /JSON/);
});

test('a retry prompt includes the previous error', () => {
  const p = buildPrompt({ previousError: 'Unexpected token } at 12' });
  assert.ok(p.includes('Unexpected token } at 12'));
  assert.match(p, /not valid JSON/i);
});

test('the first prompt does not mention a previous error', () => {
  assert.doesNotMatch(buildPrompt(), /previous answer/i);
});

test('the JSON schema uses the same vocabulary as the validator', () => {
  const props = SCENE_JSON_SCHEMA.properties;
  assert.deepEqual(props.mood.enum, MOODS);
  assert.deepEqual(props.objects.items.properties.shape.enum, SHAPES);
  assert.deepEqual(props.objects.items.properties.animation.enum, ANIMATIONS);
  assert.deepEqual(SCENE_JSON_SCHEMA.required, ['title', 'mood', 'palette', 'objects']);
  assert.equal(SCENE_JSON_SCHEMA.type, 'object');
});
