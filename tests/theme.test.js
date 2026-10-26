import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCss, renderIndexHtml } from '../src/generate.js';
import { contrastRatio } from '../src/color.js';
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

test('the 3D canvas lives inside the hero, so it scrolls away with it', () => {
  const html = renderIndexHtml(scene());
  assert.match(html, /<section class="hero">\s*<canvas id="stage" aria-hidden="true"><\/canvas>/);
  assert.equal([...html.matchAll(/<canvas /g)].length, 1);
});

/* ---------- css: palette, safety ---------- */

const LIGHT = { background: '#dfe3fb', primary: '#7b6cf6', accent: '#a8e6f0' };
const DARK = { background: '#101820', primary: '#f2aa4c', accent: '#e0e0e0' };

test('the css uses only the validated palette colours', () => {
  const css = renderCss(scene({ palette: DARK }));
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

test('text colours are worked out from the palette, so any palette stays readable', () => {
  const light = renderCss(scene({ palette: LIGHT }));
  assert.match(light, /--ink:\s*#0a0a23/);
  const dark = renderCss(scene({ palette: DARK }));
  assert.match(dark, /--ink:\s*#ffffff/);
  assert.match(dark, /--on-primary:\s*#0a0a23/); // orange button gets dark text
  assert.match(light, /--on-primary:\s*#0a0a23/);
  const navy = renderCss(scene({ palette: { background: '#fafafa', primary: '#1a237e', accent: '#ffd54f' } }));
  assert.match(navy, /--on-primary:\s*#ffffff/); // navy button gets white text
});

test('a model palette with bad contrast cannot make the text unreadable', () => {
  const css = renderCss(scene({ palette: { background: '#808080', primary: '#808080', accent: '#818181' } }));
  const ink = css.match(/--ink:\s*(#[0-9a-f]{6})/)[1];
  assert.ok(contrastRatio(ink, '#808080') >= 4.3);
});

/* ---------- css: the modern look (soft gradient, rounded glass, no retro) ---------- */

test('the page has a soft gradient built from the palette, with a plain fallback', () => {
  const css = renderCss(scene({ palette: LIGHT }));
  assert.match(css, /html\s*\{[^}]*background:\s*var\(--bg\)/);
  assert.match(css, /@supports \(color: color-mix\(in srgb, red 50%, blue\)\)\s*\{[^@]*body\s*\{[^}]*background:\s*linear-gradient\([^;]*color-mix\(in srgb, var\(--primary\)/);
});

test('the gradient is not overridden: the colour-mix block comes after the plain body rule', () => {
  const css = renderCss(scene({ palette: LIGHT }));
  const plain = css.indexOf('body { margin: 0');
  const gradient = css.indexOf('linear-gradient(');
  assert.ok(plain >= 0 && gradient >= 0);
  assert.ok(gradient > plain, 'a later plain "body" rule would hide the gradient');
});

test('the top bar is a rounded glass pill that floats over the page', () => {
  const css = renderCss(scene());
  assert.match(css, /\.nav\s*\{[^}]*position:\s*fixed/);
  assert.match(css, /\.nav\s*\{[^}]*border-radius:\s*999px/);
  assert.match(css, /\.nav\s*\{[^}]*backdrop-filter:\s*blur\(/);
  assert.match(css, /\.nav\s*\{[^}]*background:\s*var\(--surface\)/);
});

test('cards are rounded glass panels with a soft shadow', () => {
  const css = renderCss(scene());
  assert.match(css, /\.card\s*\{[^}]*border-radius:\s*(1[6-9]|[2-9]\d)px/);
  assert.match(css, /\.card\s*\{[^}]*background:\s*var\(--surface\)/);
  assert.match(css, /\.card\s*\{[^}]*box-shadow:\s*var\(--shadow\)/);
  assert.match(css, /--shadow:\s*0 \d+px \d+px rgba\(/);
});

test('the title sits in a rounded outlined plate', () => {
  const css = renderCss(scene());
  assert.match(css, /\.plate\s*\{[^}]*border:\s*[\d.]+px solid var\(--ink\)/);
  assert.match(css, /\.plate\s*\{[^}]*border-radius:/);
  assert.match(css, /\.plate\s*\{[^}]*color:\s*var\(--ink\)/);
});

test('buttons are rounded pills: a filled primary one and an outlined secondary one', () => {
  const css = renderCss(scene());
  assert.match(css, /\.btn\s*\{[^}]*border-radius:\s*999px/);
  assert.match(css, /\.btn\s*\{[^}]*border:\s*1px solid var\(--ink\)/);
  assert.match(css, /\.btn\.primary\s*\{[^}]*background:\s*var\(--primary\)/);
  assert.match(css, /\.btn\.primary\s*\{[^}]*color:\s*var\(--on-primary\)/);
  assert.match(css, /\.btn:hover\s*\{[^}]*transform:\s*translateY\(-\d+px\)/);
});

test('the current top bar link is a filled pill that stays readable', () => {
  assert.match(renderCss(scene()), /\.nav nav a\[aria-current\]\s*\{[^}]*background:\s*var\(--primary\)[^}]*color:\s*var\(--on-primary\)/);
});

test('none of the old retro styling is left', () => {
  const css = renderCss(scene());
  assert.ok(!/image-rendering/.test(css));
  assert.ok(!/Courier|monospace|--mono/.test(css));
  assert.ok(!/\d+px \d+px 0 \d+px/.test(css), 'hard pixel shadows');
  assert.ok(!/h2::before/.test(css));
});

test('headings use the system sans font in a medium weight with tight tracking', () => {
  const css = renderCss(scene());
  assert.match(css, /--sans:[^;]*system-ui/);
  assert.match(css, /body\s*\{[^}]*font-family:\s*var\(--sans\)/);
  assert.match(css, /h1\s*\{[^}]*font-weight:\s*[45]00/);
  assert.match(css, /h1\s*\{[^}]*letter-spacing:\s*-/);
});

/* ---------- css: layout and finish ---------- */

test('paragraph lines stay short enough to read', () => {
  assert.match(renderCss(scene()), /p\s*\{[^}]*max-width:\s*(\d\d)ch/);
});

test('keyboard focus is visible', () => {
  assert.match(renderCss(scene()), /:focus-visible\s*\{[^}]*outline:\s*\d+px solid var\(--primary\)/);
});

test('cards flow into a responsive grid', () => {
  assert.match(renderCss(scene()), /\.cards\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(/);
});

test('the canvas is part of the hero: a band under the top bar on phones', () => {
  const css = renderCss(scene());
  assert.match(css, /\.hero\s*\{[^}]*position:\s*relative/);
  assert.match(css, /#stage\s*\{[^}]*position:\s*absolute[^}]*height:\s*\d+vh/);
  assert.match(css, /\.hero\s*\{[^}]*padding-top:\s*calc\(/);
});

test('on wide screens the canvas fills the right side of the hero, beside the text', () => {
  const css = renderCss(scene());
  assert.match(css, /@media \(min-width: \d+px\)\s*\{[^@]*#stage\s*\{[^}]*right:\s*0[^}]*width:\s*calc\(100% - \d+rem\)/);
  assert.match(css, /@media \(min-width: \d+px\)\s*\{[^@]*#stage\s*\{[^}]*height:\s*100%/);
  assert.match(css, /\.hero-copy\s*\{[^}]*z-index:\s*1/);
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
