import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonText, parseJsonLoose } from '../src/repair.js';

test('plain JSON parses', () => {
  assert.deepEqual(parseJsonLoose('{"a":1}'), { ok: true, value: { a: 1 } });
});

test('code fences are stripped', () => {
  const r = parseJsonLoose('```json\n{"a": 1}\n```');
  assert.deepEqual(r.value, { a: 1 });
});

test('chatter before and after the object is ignored', () => {
  const r = parseJsonLoose('Sure! Here is the scene:\n{"a": {"b": [1,2]}}\nHope that helps {really}.');
  assert.deepEqual(r.value, { a: { b: [1, 2] } });
});

test('braces inside strings do not confuse the extractor', () => {
  const text = 'x {"t": "a } b { c", "n": 2} y';
  assert.equal(extractJsonText(text), '{"t": "a } b { c", "n": 2}');
  assert.deepEqual(parseJsonLoose(text).value, { t: 'a } b { c', n: 2 });
});

test('escaped quotes inside strings are handled', () => {
  const r = parseJsonLoose('{"t": "say \\"hi\\" }"}');
  assert.equal(r.value.t, 'say "hi" }');
});

test('trailing commas are tolerated', () => {
  const r = parseJsonLoose('{"a": [1, 2,], "b": {"c": 1,},}');
  assert.deepEqual(r.value, { a: [1, 2], b: { c: 1 } });
});

test('a BOM and surrounding whitespace are ignored', () => {
  assert.deepEqual(parseJsonLoose('\uFEFF  \n {"a":1} \n').value, { a: 1 });
});

test('no object at all gives a clear error', () => {
  const r = parseJsonLoose('I cannot see an image.');
  assert.equal(r.ok, false);
  assert.match(r.error, /no JSON object/i);
});

test('truncated JSON gives an error, not a crash', () => {
  const r = parseJsonLoose('{"a": [1, 2');
  assert.equal(r.ok, false);
  assert.match(r.error, /incomplete|truncated|valid/i);
});

test('invalid JSON inside braces reports the parser message', () => {
  const r = parseJsonLoose('{"a": nope}');
  assert.equal(r.ok, false);
  assert.ok(r.error.length > 5);
});

test('non-string input is an error', () => {
  for (const bad of [null, undefined, 5, {}]) assert.equal(parseJsonLoose(bad).ok, false);
});

test('only the first top-level object is used', () => {
  assert.deepEqual(parseJsonLoose('{"a":1} {"b":2}').value, { a: 1 });
});
