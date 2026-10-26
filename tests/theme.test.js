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

const many = (n) => Array.from({ length: n }, (_, i) => ({ heading: `Heading ${i + 1}`, text: `Text ${i + 1}.` }));

/* ---------- page structure (landing page: nav, hero, details, about) ---------- */

test('the page has a top bar with the brand, a home link and the mood badge', () => {
  const html = renderIndexHtml(scene());
  const nav = html.match(/<header class="nav" id="top">([\s\S]*?)<\/header>/)[1];
  assert.match(nav, /class="brand"[^>]*>[\s\S]*Diorama/);
  assert.match(nav, /<a href="#top"[^>]*>Home<\/a>/);
  assert.match(nav, /class="badge"[^>]*>playful</);
});

test('the top bar links to at most three sections, with escaped headings', () => {
  const html = renderIndexHtml(scene({ sections: many(4) }));
  const nav = html.match(/<header class="nav" id="top">([\s\S]*?)<\/header>/)[1];
  assert.equal([...nav.matchAll(/href="#s\d"/g)].length, 3);
  assert.ok(nav.includes('href="#s1"') && nav.includes('href="#s3"') && !nav.includes('href="#s4"'));
  const hostile = renderIndexHtml(scene({ sections: [{ heading: '<img src=x onerror=1>', text: 't' }] }));
  assert.ok(!hostile.includes('<img'));
});

test('the hero names the mood and shows the escaped title on a plate', () => {
  const html = renderIndexHtml(scene({ title: '<b>x</b>' }));
  assert.equal([...html.matchAll(/<h1[ >]/g)].length, 1);
  const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/)[1];
  assert.match(h1, /class="lead"[^>]*>A playful scene for</);
  assert.match(h1, /class="plate"[^>]*>&lt;b&gt;x&lt;\/b&gt;</);
  assert.ok(!h1.includes('<b>'));
});

test('the hero line uses "An" before a vowel mood', () => {
  assert.match(renderIndexHtml(scene({ mood: 'elegant' })), /An elegant scene for/);
  assert.match(renderIndexHtml(scene({ mood: 'energetic' })), /An energetic scene for/);
  assert.match(renderIndexHtml(scene({ mood: 'calm' })), /A calm scene for/);
});

test('the hero has a primary and a secondary button that jump within the page', () => {
  const html = renderIndexHtml(scene());
  assert.match(html, /<a class="btn primary" href="#details">See details<\/a>/);
  assert.match(html, /<a class="btn" href="#about">About this page<\/a>/);
});

test('every link on the page stays on the page', () => {
  const html = renderIndexHtml(scene({ sections: many(4) }));
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]).filter((h) => !h.endsWith('.css'));
  assert.ok(hrefs.length >= 6);
  for (const h of hrefs) assert.match(h, /^#[a-z0-9]+$/);
});

test('there is one card per section, each with an id the top bar can link to', () => {
  const html = renderIndexHtml(scene());
  assert.equal([...html.matchAll(/class="card"/g)].length, 2);
  assert.match(html, /<section class="card" id="s1">/);
  assert.match(html, /<section class="card" id="s2">/);
  assert.match(html, /<h2>Warm light<\/h2>/);
});

test('a scene without sections has no details area, no section links and no "See details" button', () => {
  const html = renderIndexHtml(scene({ sections: [] }));
  assert.ok(!html.includes('id="details"'));
  assert.ok(!html.includes('href="#details"'));
  assert.equal([...html.matchAll(/class="card"/g)].length, 0);
  assert.match(html, /<a class="btn primary" href="#about">About this page<\/a>/);
  assert.equal([...html.matchAll(/class="btn"/g)].length, 0);
});

test('the about footer says what made the page and that it loads nothing from the network', () => {
  const html = renderIndexHtml(scene());
  const about = html.match(/<footer class="about" id="about">([\s\S]*?)<\/footer>/)[1];
  assert.match(about, /Diorama/);
  assert.match(about, /no network requests/i);
});

/* ---------- css: palette, safety ---------- */

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

/* ---------- css: the retro pixel look ---------- */

test('the css has the pixel look: pixelated images, hard offset shadows, monospace', () => {
  const css = renderCss(scene());
  assert.match(css, /image-rendering:\s*pixelated/);
  assert.match(css, /box-shadow:[^;]*\d+px \d+px 0/);
  assert.match(css, /monospace/);
});

test('the top bar, the title plate and the cards have a hard offset shadow in the primary colour', () => {
  const css = renderCss(scene());
  assert.match(css, /\.nav\s*\{[^}]*\d+px \d+px 0 \d+px var\(--primary\)/);
  assert.match(css, /\.plate\s*\{[^}]*\d+px \d+px 0 \d+px var\(--primary\)/);
  assert.match(css, /\.card\s*\{[^}]*\d+px \d+px 0 \d+px var\(--primary\)/);
});

test('buttons are square pixel buttons: a filled primary one and an outlined secondary one', () => {
  const css = renderCss(scene());
  assert.match(css, /\.btn\s*\{[^}]*0 0 0 2px var\(--accent\)/);
  assert.match(css, /\.btn\.primary\s*\{[^}]*background:\s*var\(--primary\)/);
  assert.match(css, /\.btn\.primary\s*\{[^}]*color:\s*var\(--bg\)/);
  assert.match(css, /\.btn:hover\s*\{[^}]*transform:\s*translate/);
});

test('each card heading has a small pixel marker', () => {
  assert.match(renderCss(scene()), /h2::before\s*\{[^}]*background:\s*var\(--primary\)/);
});

/* ---------- css: professional finish ---------- */

test('body text uses the system sans font; headings and buttons keep the monospace pixel feel', () => {
  const css = renderCss(scene());
  assert.match(css, /--sans:[^;]*system-ui/);
  assert.match(css, /--mono:[^;]*monospace/);
  assert.match(css, /body\s*\{[^}]*font-family:\s*var\(--sans\)/);
  assert.match(css, /h1\s*\{[^}]*font-family:\s*var\(--mono\)/);
  assert.match(css, /h2\s*\{[^}]*font-family:\s*var\(--mono\)/);
  assert.match(css, /\.btn\s*\{[^}]*font-family:\s*var\(--mono\)/);
});

test('paragraph lines stay short enough to read', () => {
  assert.match(renderCss(scene()), /p\s*\{[^}]*max-width:\s*(\d\d)ch/);
});

test('keyboard focus is visible', () => {
  assert.match(renderCss(scene()), /:focus-visible\s*\{[^}]*outline:\s*\d+px solid var\(--primary\)/);
});

test('surfaces use a colour derived from the palette, with a safe fallback', () => {
  const css = renderCss(scene());
  assert.match(css, /--panel:\s*var\(--bg\)/);
  assert.match(css, /@supports \(color: color-mix\(in srgb, red 50%, blue\)\)\s*\{[^}]*--panel:\s*color-mix\(in srgb, var\(--bg\)/);
  assert.match(css, /\.card\s*\{[^}]*background:\s*var\(--panel\)/);
  assert.match(css, /\.nav\s*\{[^}]*background:\s*var\(--panel\)/);
});

test('the top bar floats over the page and stays put while scrolling', () => {
  assert.match(renderCss(scene()), /\.nav\s*\{[^}]*position:\s*fixed/);
});

test('the details area is opaque and sits above the 3D canvas, so cards stay readable', () => {
  const css = renderCss(scene());
  assert.match(css, /\.details\s*\{[^}]*background:\s*var\(--bg\)/);
  assert.match(css, /\.details\s*\{[^}]*z-index:\s*2/);
  assert.match(css, /\.details\s*\{[^}]*position:\s*relative/);
});

test('cards flow into a responsive grid', () => {
  assert.match(renderCss(scene()), /\.cards\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(/);
});

/* ---------- css: responsive ---------- */

test('on phones and narrow screens the 3D scene is a band under the top bar, above the hero text', () => {
  const css = renderCss(scene());
  assert.match(css, /#stage\s*\{[^}]*position:\s*fixed[^}]*height:\s*\d+vh/);
  assert.match(css, /\.hero\s*\{[^}]*padding-top:\s*calc\(/);
});

test('on wide screens the 3D canvas fills the right side, beside the hero text', () => {
  const css = renderCss(scene());
  assert.match(css, /@media \(min-width: \d+px\)\s*\{[^@]*#stage\s*\{[^}]*left:\s*\d+rem/);
  assert.match(css, /@media \(min-width: \d+px\)\s*\{[^@]*#stage\s*\{[^}]*height:\s*100vh/);
});

test('on phones the section links leave the top bar so it does not overflow', () => {
  assert.match(renderCss(scene()), /@media \(max-width: 640px\)\s*\{[^@]*\.nav nav\s*\{[^}]*display:\s*none/);
});

test('long text cannot break the layout', () => {
  const css = renderCss(scene());
  assert.match(css, /\.plate\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.nav nav a\s*\{[^}]*text-overflow:\s*ellipsis/);
});

test('motion is respected: smooth scrolling only when allowed, transitions off for reduced motion', () => {
  const css = renderCss(scene());
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)\s*\{[^}]*scroll-behavior:\s*smooth/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*transition:\s*none/);
});
