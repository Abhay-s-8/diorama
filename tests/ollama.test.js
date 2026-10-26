import test from 'node:test';
import assert from 'node:assert/strict';
import { OllamaError, chatVision, normalizeBaseUrl, DEFAULT_HOST } from '../src/ollama.js';

const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const base = { model: 'gemma3:4b', prompt: 'describe', imageBase64: 'QUJD', schema: { type: 'object' } };

test('normalizeBaseUrl handles empty, trailing slashes, missing scheme and bad schemes', () => {
  assert.equal(normalizeBaseUrl(''), DEFAULT_HOST);
  assert.equal(normalizeBaseUrl(undefined), DEFAULT_HOST);
  assert.equal(normalizeBaseUrl(' http://h:1/// '), 'http://h:1');
  assert.equal(normalizeBaseUrl('localhost:11434'), 'http://localhost:11434');
  assert.equal(normalizeBaseUrl('https://x.example'), 'https://x.example');
  assert.throws(() => normalizeBaseUrl('ftp://x'), /http/);
  assert.throws(() => normalizeBaseUrl('file:///etc/passwd'), /http/);
});

test('chatVision posts the image as base64 with a JSON schema and no streaming', async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init, body: JSON.parse(init.body) };
    return res(200, { message: { content: '{"title":"x"}' } });
  };
  const out = await chatVision({ ...base, host: 'http://localhost:11434/', fetchImpl });
  assert.equal(out, '{"title":"x"}');
  assert.equal(seen.url, 'http://localhost:11434/api/chat');
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers['Content-Type'], 'application/json');
  assert.equal(seen.body.model, 'gemma3:4b');
  assert.equal(seen.body.stream, false);
  assert.deepEqual(seen.body.format, { type: 'object' });
  assert.deepEqual(seen.body.messages, [{ role: 'user', content: 'describe', images: ['QUJD'] }]);
  assert.equal(typeof seen.body.options.temperature, 'number');
});

const kinds = async (fetchImpl, opts = {}) => {
  try {
    await chatVision({ ...base, host: DEFAULT_HOST, fetchImpl, ...opts });
  } catch (e) {
    assert.ok(e instanceof OllamaError, String(e));
    return e;
  }
  assert.fail('expected an error');
};

test('an unreachable server is reported with the host', async () => {
  const e = await kinds(async () => { throw new TypeError('fetch failed'); });
  assert.equal(e.kind, 'unreachable');
  assert.match(e.message, /localhost:11434/);
  assert.match(e.message, /ollama serve|running/i);
});

test('a missing model explains how to pull it', async () => {
  const e = await kinds(async () => res(404, { error: "model 'gemma3:4b' not found" }));
  assert.equal(e.kind, 'model_missing');
  assert.match(e.message, /ollama pull gemma3:4b/);
});

test('a model without vision support gets a hint', async () => {
  const e = await kinds(async () => res(400, { error: 'this model does not support images' }));
  assert.equal(e.kind, 'http');
  assert.match(e.message, /vision/i);
});

test('other HTTP errors include status and detail; non-JSON bodies do not hide the status', async () => {
  const a = await kinds(async () => res(500, { error: 'out of memory' }));
  assert.match(a.message, /500.*out of memory/);
  const b = await kinds(async () => ({ ok: false, status: 502, json: async () => { throw new Error('x'); } }));
  assert.match(b.message, /502/);
});

test('an empty answer is an error', async () => {
  for (const body of [{}, { message: {} }, { message: { content: '  ' } }]) {
    const e = await kinds(async () => res(200, body));
    assert.equal(e.kind, 'empty');
  }
});

test('a slow model is aborted with a timeout error', async () => {
  const fetchImpl = (url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
  });
  const e = await kinds(fetchImpl, { timeoutMs: 30 });
  assert.equal(e.kind, 'timeout');
  assert.match(e.message, /longer than/);
});

test('required arguments are checked', async () => {
  await assert.rejects(chatVision({ ...base, imageBase64: '', fetchImpl: async () => res(200, {}) }), /image/i);
  await assert.rejects(chatVision({ ...base, model: '', fetchImpl: async () => res(200, {}) }), /model/i);
});
