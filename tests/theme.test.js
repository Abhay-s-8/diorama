import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCss, renderIndexHtml } from '../src/generate.js';
import { FALLBACK_SCENE } from '../src/schema.js';

const scene = (over = {}) => ({
  ...FALLBACK_SCENE,
  title: 'Retro lamp',
  mood: 'playful',
  sections: [
    { heading: 'Warm light', text: 'Soft and quiet.' },
    { heading: 'Small shapes', text: 'Boxes and spheres.' },
  ],
  ...over,
});

test('the page is a retro window: title bar, mood badge, one card per section', () => {
  const html = renderIndexHtml(scene());
  assert.match(html, /class="window"/);
  assert.match(html, /class="titlebar"/);
  assert.match(html, /class="badge"[^>]*>playful</);
  assert.equal([...html.matchAll(/class="card"/g)].length, 2);
});

test('the title bar shows the scene title, escaped', () => {
  const html = renderIndexHtml(scene({ title: '<b>x</b>' }));
  const bar = html.match(/<div class="titlebar">([\s\S]*?)<\/div>/)[1];
  assert.ok(bar.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(!bar.includes('<b>'));
});

test('a scene without sections still renders a window and no empty cards', () => {
  const html = renderIndexHtml(scene({ sections: [] }));
  assert.match(html, /class="window"/);
  assert.equal([...html.matchAll(/class="card"/g)].length, 0);
});

test('the css has the pixel look: stepped borders, hard shadows, pixelated images, monospace', () => {
  const css = renderCss(scene());
  assert.match(css, /image-rendering:\s*pixelated/);
  assert.match(css, /box-shadow:[^;]*\d+px \d+px 0/);
  assert.match(css, /monospace/);
  assert.match(css, /\.window/);
  assert.match(css, /\.card/);
  assert.match(css, /\.titlebar/);
});

test('the css uses only the validated palette colours', () => {
  const css = renderCss(scene({ palette: { background: '#101820', primary: '#f2aa4c', accent: '#e0e0e0' } }));
  assert.match(css, /--bg:\s*#101820/);
  assert.match(css, /--primary:\s*#f2aa4c/);
  assert.match(css, /--accent:\s*#e0e0e0/);
});

test('a hostile palette cannot inject css', () => {
  const css = renderCss(scene({ palette: { background: 'red;} body{display:none', primary: 'url(//evil)', accent: '#fff' } }));
  assert.ok(!css.includes('display:none'));
  assert.ok(!css.includes('evil'));
  assert.match(css, /--accent:\s*#ffffff/);
});

test('the css makes no network requests and loads no fonts', () => {
  const css = renderCss(scene());
  assert.ok(!/url\(/i.test(css));
  assert.ok(!/@import/i.test(css));
  assert.ok(!/@font-face/i.test(css));
  assert.ok(!/https?:\/\//i.test(css));
});

test('the layout is responsive and respects reduced motion', () => {
  const css = renderCss(scene());
  assert.match(css, /@media \(max-width/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('text stays readable: the window background and text colours are separate variables', () => {
  const css = renderCss(scene());
  assert.match(css, /\.window\s*\{[^}]*background:\s*var\(--bg\)/);
  assert.match(css, /\.window\s*\{[^}]*color:\s*var\(--accent\)/);
});

test('the window and the cards have a hard offset shadow in the primary colour', () => {
  const css = renderCss(scene());
  assert.match(css, /\.window\s*\{[^}]*\d+px \d+px 0 0 var\(--primary\)/);
  assert.match(css, /\.card\s*\{[^}]*\d+px \d+px 0 \d+px var\(--primary\)/);
});

test('on wide screens the 3D canvas sits beside the window instead of behind it', () => {
  const css = renderCss(scene());
  assert.match(css, /@media \(min-width: \d+px\)\s*\{[^}]*#stage\s*\{[^}]*left:\s*\d+rem/);
});
