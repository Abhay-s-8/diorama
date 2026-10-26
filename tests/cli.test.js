import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from '../src/cli.js';
import { FALLBACK_SCENE } from '../src/schema.js';
import { OllamaError } from '../src/ollama.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'i2s-cli-'));
const dir = tmp();
const threeFile = path.join(dir, 'three.module.min.js');
fs.writeFileSync(threeFile, '// fake three');
const image = path.join(dir, 'lamp.png');
fs.writeFileSync(image, Buffer.from([137, 80, 78, 71, 1, 2, 3]));

const sceneResult = (over = {}) => ({
  scene: { ...FALLBACK_SCENE, title: 'From model' },
  warnings: [],
  retries: 0,
  usedFallback: false,
  ...over,
});

async function run(argv, describeFn) {
  let out = '';
  let err = '';
  const calls = [];
  const code = await main(argv, {
    out: { write: (s) => { out += s; } },
    err: { write: (s) => { err += s; } },
    describeFn: describeFn && (async (a) => { calls.push(a); return describeFn(a); }),
    cwd: dir,
  });
  return { code, out, err, calls };
}

test('a normal run describes the image and writes the site', async () => {
  const o = path.join(tmp(), 'site');
  const r = await run([image, '--out', o, '--three', threeFile], async () => sceneResult());
  assert.equal(r.code, 0);
  assert.ok(fs.existsSync(path.join(o, 'index.html')));
  assert.match(fs.readFileSync(path.join(o, 'index.html'), 'utf8'), /From model/);
  assert.ok(r.out.includes(path.join(o, 'index.html')));
  assert.match(r.out, /Live Server|http server/i);
});

test('the image is sent as base64 with the default model and host', async () => {
  const o = path.join(tmp(), 'site');
  const r = await run([image, '--out', o, '--three', threeFile], async () => sceneResult());
  assert.equal(r.calls[0].imageBase64, fs.readFileSync(image).toString('base64'));
  assert.equal(r.calls[0].model, 'gemma3:4b');
  assert.equal(r.calls[0].host, 'http://localhost:11434');
});

test('--model and --host are passed through', async () => {
  const r = await run([image, '--print-json', '--model', 'qwen2.5vl', '--host', 'http://h:1'], async () => sceneResult());
  assert.equal(r.calls[0].model, 'qwen2.5vl');
  assert.equal(r.calls[0].host, 'http://h:1');
});

test('--print-json prints the scene and writes nothing', async () => {
  const o = path.join(tmp(), 'site');
  const r = await run([image, '--print-json', '--out', o], async () => sceneResult());
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.out).title, 'From model');
  assert.ok(!fs.existsSync(o));
});

test('--demo builds a page from the built-in scene without any model or image', async () => {
  const o = path.join(tmp(), 'demo');
  const r = await run(['--demo', '--out', o, '--three', threeFile]);
  assert.equal(r.code, 0);
  assert.equal(r.calls.length, 0);
  assert.ok(fs.existsSync(path.join(o, 'index.html')));
});

test('the default output folder is out/<image name> under the working directory', async () => {
  const r = await run([image, '--three', threeFile], async () => sceneResult());
  assert.equal(r.code, 0);
  assert.ok(fs.existsSync(path.join(dir, 'out', 'lamp', 'index.html')));
});

test('model warnings and fallbacks are shown but do not fail the run', async () => {
  const o = path.join(tmp(), 'site');
  const r = await run([image, '--out', o, '--three', threeFile], async () =>
    sceneResult({ warnings: ['size clamped'], usedFallback: true }));
  assert.equal(r.code, 0);
  assert.match(r.err, /size clamped/);
  assert.match(r.err, /default scene/i);
});

test('usage errors exit with code 2', async () => {
  for (const argv of [[], ['--model'], [image, '--bogus'], [image, 'second.png']]) {
    const r = await run(argv, async () => sceneResult());
    assert.equal(r.code, 2, JSON.stringify(argv));
    assert.match(r.err, /usage|unknown|missing|expected/i);
  }
});

test('a missing image file exits 2 and names the path', async () => {
  const r = await run(['/no/such/pic.png'], async () => sceneResult());
  assert.equal(r.code, 2);
  assert.match(r.err, /no\/such\/pic\.png/);
});

test('an unsupported file type exits 2', async () => {
  const f = path.join(dir, 'notes.txt');
  fs.writeFileSync(f, 'hi');
  const r = await run([f], async () => sceneResult());
  assert.equal(r.code, 2);
  assert.match(r.err, /png|jpg|jpeg|webp/i);
});

test('an image over 10 MB exits 2', async () => {
  const f = path.join(dir, 'big.jpg');
  fs.writeFileSync(f, Buffer.alloc(10 * 1024 * 1024 + 1));
  const r = await run([f], async () => sceneResult());
  assert.equal(r.code, 2);
  assert.match(r.err, /10 ?MB/);
});

test('an unreachable Ollama exits 3 with the readable message and writes no page', async () => {
  const o = path.join(tmp(), 'site');
  const r = await run([image, '--out', o, '--three', threeFile], async () => {
    throw new OllamaError('unreachable', 'Could not reach Ollama at http://localhost:11434.');
  });
  assert.equal(r.code, 3);
  assert.match(r.err, /Could not reach Ollama/);
  assert.ok(!fs.existsSync(o));
});

test('a missing three.js exits 2 with the npm install hint', async () => {
  const o = path.join(tmp(), 'site');
  const r = await run([image, '--out', o, '--three', '/no/three.js'], async () => sceneResult());
  assert.equal(r.code, 2);
  assert.match(r.err, /npm install/);
});

test('unexpected errors exit 1 with a message, not a stack trace', async () => {
  const r = await run([image, '--print-json'], async () => { throw new Error('boom'); });
  assert.equal(r.code, 1);
  assert.match(r.err, /boom/);
  assert.ok(!/at .*\.js:\d+/.test(r.err));
});
