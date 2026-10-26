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

test('the window ends with a status bar that counts sections and names the tool', () => {
  const html = renderIndexHtml(scene());
  assert.match(html, /<footer class="statusbar">[\s\S]*2 sections[\s\S]*Diorama[\s\S]*<\/footer>/);
});

test('the status bar says "1 section" and "0 sections" correctly', () => {
  assert.match(renderIndexHtml(scene({ sections: [{ heading: 'a', text: 'b' }] })), /1 section</);
  assert.match(renderIndexHtml(scene({ sections: [] })), /0 sections</);
});

test('body text uses the system sans font for readability; headings keep the monospace pixel feel', () => {
  const css = renderCss(scene());
  assert.match(css, /--sans:[^;]*system-ui/);
  assert.match(css, /--mono:[^;]*monospace/);
  assert.match(css, /\.body\s*\{[^}]*font-family:\s*var\(--sans\)/);
  assert.match(css, /h1\s*\{[^}]*font-family:\s*var\(--mono\)/);
  assert.match(css, /h2\s*\{[^}]*font-family:\s*var\(--mono\)/);
});

test('paragraph lines stay short enough to read', () => {
  assert.match(renderCss(scene()), /p\s*\{[^}]*max-width:\s*(\d\d)ch/);
});

test('keyboard focus is visible', () => {
  assert.match(renderCss(scene()), /:focus-visible\s*\{[^}]*outline:\s*\d+px solid var\(--primary\)/);
});

test('cards use a thin frame and a surface colour derived from the palette, with a safe fallback', () => {
  const css = renderCss(scene());
  assert.match(css, /--panel:\s*var\(--bg\)/);
  assert.match(css, /@supports \(color: color-mix\(in srgb, red 50%, blue\)\)\s*\{[^}]*--panel:\s*color-mix\(in srgb, var\(--bg\)/);
  assert.match(css, /\.card\s*\{[^}]*background:\s*var\(--panel\)/);
  assert.match(css, /\.card\s*\{[^}]*0 0 0 2px var\(--accent\)/);
});

test('on phones the 3D scene stays visible above the window', () => {
  const css = renderCss(scene());
  assert.match(css, /@media \(max-width: 640px\)\s*\{[^@]*\.content\s*\{[^}]*padding-top:\s*\d+vh/);
});

test('each card heading has a small pixel marker', () => {
  assert.match(renderCss(scene()), /h2::before\s*\{[^}]*background:\s*var\(--primary\)/);
});

test('on wide screens the window is a full-height side panel with the status bar at the bottom', () => {
  const css = renderCss(scene());
  assert.match(css, /@media \(min-width: \d+px\)\s*\{[^@]*\.window\s*\{[^}]*min-height:\s*calc\(100vh - [\d.]+rem\)/);
  assert.match(css, /@media \(min-width: \d+px\)\s*\{[^@]*\.window\s*\{[^}]*display:\s*flex/);
  assert.match(css, /@media \(min-width: \d+px\)\s*\{[^@]*\.body\s*\{[^}]*flex:\s*1/);
});
