import test from 'node:test';
import assert from 'node:assert/strict';
import { describeImage } from '../src/describe.js';
import { FALLBACK_SCENE } from '../src/schema.js';
import { OllamaError } from '../src/ollama.js';

const sceneJson = JSON.stringify({
  title: 'Sketch',
  mood: 'playful',
  palette: { background: '#112233', primary: '#ff8800', accent: '#ffffff' },
  objects: [{ shape: 'cone', color: '#ff8800', position: [0, 0, 0], size: 1, animation: 'spin' }],
  sections: [],
});

function fakeFetch(contents, requests = []) {
  let i = 0;
  const fn = async (url, init) => {
    requests.push(JSON.parse(init.body));
    const content = contents[Math.min(i++, contents.length - 1)];
    return { ok: true, status: 200, json: async () => ({ message: { content } }) };
  };
  return fn;
}
const args = (fetchImpl) => ({ imageBase64: 'QUJD', model: 'gemma3:4b', host: 'http://localhost:11434', fetchImpl });

test('valid JSON on the first try', async () => {
  const r = await describeImage(args(fakeFetch([sceneJson])));
  assert.equal(r.scene.title, 'Sketch');
  assert.equal(r.retries, 0);
  assert.equal(r.usedFallback, false);
  assert.deepEqual(r.warnings, []);
});

test('fenced JSON with chatter is accepted without a retry', async () => {
  const r = await describeImage(args(fakeFetch([`Here you go:\n\`\`\`json\n${sceneJson}\n\`\`\``])));
  assert.equal(r.retries, 0);
  assert.equal(r.scene.objects[0].shape, 'cone');
});

test('invalid JSON triggers exactly one retry that includes the error and the image', async () => {
  const requests = [];
  const r = await describeImage(args(fakeFetch(['{"title": oops}', sceneJson], requests)));
  assert.equal(requests.length, 2);
  assert.equal(r.retries, 1);
  assert.equal(r.usedFallback, false);
  assert.match(requests[1].messages[0].content, /not valid JSON/i);
  assert.deepEqual(requests[1].messages[0].images, ['QUJD']);
  assert.doesNotMatch(requests[0].messages[0].content, /previous answer/i);
});

test('invalid twice gives the fallback scene and a loud warning, never a crash', async () => {
  const requests = [];
  const r = await describeImage(args(fakeFetch(['nope', 'still nope'], requests)));
  assert.equal(requests.length, 2);
  assert.equal(r.usedFallback, true);
  assert.deepEqual(r.scene, FALLBACK_SCENE);
  assert.ok(r.warnings.some((w) => /default scene/i.test(w)));
});

test('valid JSON that is not an object is treated as a fallback', async () => {
  const r = await describeImage(args(fakeFetch(['{"a":1}'])));
  assert.equal(r.scene.objects.length, FALLBACK_SCENE.objects.length);
  assert.equal(r.usedFallback, true);
});

test('out-of-range values are cleaned and the warnings are passed on', async () => {
  const messy = JSON.stringify({ ...JSON.parse(sceneJson), objects: [{ shape: 'box', color: 'red', position: [50, 0, 0], size: 99 }] });
  const r = await describeImage(args(fakeFetch([messy])));
  assert.deepEqual(r.scene.objects[0].position, [5, 0, 0]);
  assert.equal(r.scene.objects[0].size, 3);
  assert.ok(r.warnings.length > 0);
  assert.equal(r.usedFallback, false);
});

test('Ollama errors are not swallowed', async () => {
  const fetchImpl = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(describeImage(args(fetchImpl)), (e) => e instanceof OllamaError && e.kind === 'unreachable');
});
