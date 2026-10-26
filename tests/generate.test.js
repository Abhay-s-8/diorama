import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderIndexHtml, writeSite } from '../src/generate.js';
import { FALLBACK_SCENE } from '../src/schema.js';

const scene = (over = {}) => ({
  ...FALLBACK_SCENE,
  title: 'My <b>Lamp</b> & "Co"',
  sections: [{ heading: 'Warm <i>light</i>', text: 'Soft & "quiet"' }],
  ...over,
});
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'i2s-'));
const fakeThree = () => {
  const p = path.join(tmp(), 'three.module.min.js');
  fs.writeFileSync(p, '// fake three');
  return p;
};

test('the page is a complete HTML document with a canvas', () => {
  const html = renderIndexHtml(scene());
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<canvas id="stage"/);
});

test('titles and section text are HTML-escaped', () => {
  const html = renderIndexHtml(scene());
  assert.ok(!html.includes('<b>Lamp</b>'));
  assert.ok(!html.includes('<i>light</i>'));
  assert.ok(html.includes('My &lt;b&gt;Lamp&lt;/b&gt; &amp; &quot;Co&quot;'));
  assert.ok(html.includes('Warm &lt;i&gt;light&lt;/i&gt;'));
  assert.ok(html.includes('Soft &amp; &quot;quiet&quot;'));
});

test('a hostile title cannot break out of the page or the JSON block', () => {
  const evil = '</script><script>alert(1)</script>';
  const html = renderIndexHtml(scene({ title: evil, sections: [{ heading: evil, text: evil }] }));
  const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)].map((m) => m[1]);
  for (const attrs of scripts) {
    assert.ok(/type="application\/json"|type="module"/.test(attrs), attrs);
  }
  assert.equal([...html.matchAll(/<\/script>/gi)].length, scripts.length);
  assert.ok(!html.toLowerCase().includes('alert(1)</script>'));
});

test('the embedded scene JSON round-trips', () => {
  const s = scene({ title: 'a </script> b \u2028 c' });
  const html = renderIndexHtml(s);
  const m = html.match(/<script type="application\/json" id="scene-data">([\s\S]*?)<\/script>/);
  assert.ok(m);
  assert.deepEqual(JSON.parse(m[1]), s);
});

test('a strict Content-Security-Policy forbids network access and inline scripts', () => {
  const html = renderIndexHtml(scene());
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /connect-src 'none'/);
  assert.ok(!/unsafe-inline|unsafe-eval/.test(csp.replace(/style-src[^;]*;?/, '')));
});

test('the page makes no external requests', () => {
  const html = renderIndexHtml(scene());
  assert.ok(!/https?:\/\//i.test(html.replace(/<!--[\s\S]*?-->/g, '')));
});

test('writeSite writes the page, styles, runtime scripts and three.js', () => {
  const out = tmp();
  const three = fakeThree();
  const written = writeSite(scene(), out, { threeSrc: three });
  for (const f of ['index.html', 'style.css', 'main.js', 'runtime.js', 'three.module.min.js']) {
    assert.ok(fs.existsSync(path.join(out, f)), f);
  }
  assert.equal(fs.readFileSync(path.join(out, 'three.module.min.js'), 'utf8'), '// fake three');
  assert.ok(written.includes(path.join(out, 'index.html')));
});

test('main.js loads three from the same folder and runtime.js has no imports', () => {
  const out = tmp();
  writeSite(scene(), out, { threeSrc: fakeThree() });
  const main = fs.readFileSync(path.join(out, 'main.js'), 'utf8');
  const runtime = fs.readFileSync(path.join(out, 'runtime.js'), 'utf8');
  assert.match(main, /from '\.\/three\.module\.min\.js'/);
  assert.match(main, /from '\.\/runtime\.js'/);
  assert.ok(!/^import /m.test(runtime));
});

test('writeSite creates nested output folders', () => {
  const out = path.join(tmp(), 'a', 'b');
  writeSite(scene(), out, { threeSrc: fakeThree() });
  assert.ok(fs.existsSync(path.join(out, 'index.html')));
});

test('a missing three.js file explains how to get it', () => {
  assert.throws(() => writeSite(scene(), tmp(), { threeSrc: '/no/such/three.js' }), /npm install/);
});

test('main.js sizes the renderer from the canvas box, not the whole window', () => {
  const out = tmp();
  writeSite(scene(), out, { threeSrc: fakeThree() });
  const main = fs.readFileSync(path.join(out, 'main.js'), 'utf8');
  assert.match(main, /canvas\.clientWidth/);
  assert.match(main, /canvas\.clientHeight/);
  assert.ok(!/window\.innerWidth/.test(main));
});
