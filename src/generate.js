/* Turns a validated scene into a small static website. Model text is always untrusted. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INK_DARK, readableOn } from './color.js';
import { validateScene } from './schema.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** JSON that is safe inside a <script> element. */
function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export function renderIndexHtml(input) {
  const { scene } = validateScene(input);
  const sections = scene.sections;
  const article = /^[aeiou]/i.test(scene.mood) ? 'An' : 'A';
  const links = sections
    .slice(0, 3)
    .map((s, i) => `<a href="#s${i + 1}">${escapeHtml(s.heading)}</a>`)
    .join('');
  const cards = sections
    .map((s, i) => `        <section class="card" id="s${i + 1}">\n          <h2>${escapeHtml(s.heading)}</h2>\n          <p>${escapeHtml(s.text)}</p>\n        </section>`)
    .join('\n');
  const details = sections.length
    ? `    <section class="details" id="details" aria-label="Details">\n      <div class="cards">\n${cards}\n      </div>\n    </section>\n`
    : '';
  const primary = sections.length
    ? '<a class="btn primary" href="#details">See details</a><a class="btn" href="#about">About this page</a>'
    : '<a class="btn primary" href="#about">About this page</a>';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${CSP}">
  <title>${escapeHtml(scene.title)}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body data-mood="${escapeHtml(scene.mood)}">
  <header class="nav" id="top">
    <a class="brand" href="#top"><span class="logo" aria-hidden="true"></span>Diorama</a>
    <nav aria-label="Page sections"><a href="#top" aria-current="page">Home</a>${links}</nav>
    <span class="badge">${escapeHtml(scene.mood)}</span>
  </header>
  <main>
    <section class="hero">
      <canvas id="stage" aria-hidden="true"></canvas>
      <div class="hero-copy">
        <h1><span class="lead">${article} ${escapeHtml(scene.mood)} scene for</span> <span class="plate">${escapeHtml(scene.title)}</span></h1>
        <div class="actions">${primary}</div>
      </div>
    </section>
${details}  </main>
  <footer class="about" id="about">
    <p>Made with Diorama. This page was built from a scene description that was checked before it was written, and it makes no network requests.</p>
  </footer>
  <script type="application/json" id="scene-data">${safeJson(scene)}</script>
  <script type="module" src="main.js"></script>
</body>
</html>
`;
}

export function renderCss(input) {
  const { palette } = validateScene(input).scene;
  const ink = readableOn(palette.background);
  const light = ink === INK_DARK;
  const surface = light ? 'rgba(255, 255, 255, .62)' : 'rgba(255, 255, 255, .08)';
  const line = light ? 'rgba(255, 255, 255, .8)' : 'rgba(255, 255, 255, .16)';
  const shadow = light ? '0 14px 34px rgba(40, 30, 120, .14)' : '0 14px 34px rgba(0, 0, 0, .38)';
  const tint = light ? 22 : 34;
  return `:root {
  --bg: ${palette.background};
  --primary: ${palette.primary};
  --accent: ${palette.accent};
  --ink: ${ink};
  --on-primary: ${readableOn(palette.primary)};
  --muted: var(--ink);
  --tint: var(--surface);
  --surface: ${surface};
  --line: ${line};
  --shadow: ${shadow};
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
}
* { box-sizing: border-box; }
html { background: var(--bg); scroll-padding-top: 6rem; }
body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
@supports (color: color-mix(in srgb, red 50%, blue)) {
  :root {
    --muted: color-mix(in srgb, var(--ink) 78%, var(--bg));
    --tint: color-mix(in srgb, var(--primary) ${tint}%, var(--bg));
  }
  body {
    background: linear-gradient(145deg, color-mix(in srgb, var(--primary) 28%, var(--bg)) 0%, var(--bg) 45%, color-mix(in srgb, var(--accent) 42%, var(--bg)) 100%);
  }
}
.nav { position: fixed; top: .9rem; left: .9rem; right: .9rem; z-index: 5; max-width: 72rem; margin-inline: auto; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .5rem .6rem .5rem 1.1rem; background: var(--surface); border: 1px solid var(--line); border-radius: 999px; box-shadow: var(--shadow); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
.brand { display: flex; align-items: center; gap: .6rem; font-weight: 700; letter-spacing: -.01em; color: var(--ink); text-decoration: none; }
.logo { width: 22px; height: 22px; border-radius: 7px; background: linear-gradient(135deg, var(--primary), var(--accent)); }
.nav nav { display: flex; gap: .2rem; min-width: 0; }
.nav nav a { display: inline-block; max-width: 9rem; padding: .45rem .95rem; border-radius: 999px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: .88rem; color: var(--ink); text-decoration: none; }
.nav nav a:hover { background: var(--tint); }
.nav nav a[aria-current] { background: var(--primary); color: var(--on-primary); }
.badge { flex: none; padding: .4rem .95rem; border: 1px solid var(--ink); border-radius: 999px; font-size: .8rem; font-weight: 600; color: var(--ink); }
.hero { position: relative; padding: 3rem 1.5rem; padding-top: calc(5.5rem + 36vh + 1.5rem); }
#stage { position: absolute; top: 5.5rem; left: 0; width: 100%; height: 36vh; display: block; }
.hero-copy { position: relative; z-index: 1; max-width: 34rem; }
h1 { margin: 0; font-family: var(--sans); font-weight: 500; letter-spacing: -.03em; line-height: 1.08; }
.lead { display: block; margin-bottom: .7rem; font-size: clamp(1.9rem, 5.4vw, 3.1rem); }
.plate { display: inline-block; max-width: 100%; padding: .05em .3em .12em; border: 1.5px solid var(--ink); border-radius: .32em; background: var(--tint); font-size: clamp(2rem, 6vw, 3.4rem); color: var(--ink); overflow-wrap: anywhere; }
.actions { display: flex; flex-wrap: wrap; gap: .8rem; margin-top: 2rem; }
.btn { display: inline-flex; align-items: center; padding: .8rem 1.5rem; border: 1px solid var(--ink); border-radius: 999px; background: var(--surface); font-size: .95rem; font-weight: 600; color: var(--ink); text-decoration: none; transition: transform .15s, box-shadow .15s; }
.btn.primary { border-color: transparent; background: var(--primary); color: var(--on-primary); box-shadow: var(--shadow); }
.btn:hover { transform: translateY(-2px); }
.details { position: relative; padding: 3rem 1.5rem 4rem; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 1.25rem; max-width: 72rem; margin: 0 auto; }
.card { padding: 1.4rem 1.5rem 1.5rem; border: 1px solid var(--line); border-radius: 22px; background: var(--surface); box-shadow: var(--shadow); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
h2 { margin: 0 0 .5rem; font-size: 1.15rem; font-weight: 600; letter-spacing: -.01em; line-height: 1.25; color: var(--ink); }
p { margin: 0; max-width: 62ch; line-height: 1.6; font-size: .98rem; color: var(--muted); }
.about { padding: 1.2rem 1.5rem 2rem; }
.about p { max-width: 72rem; margin: 0 auto; font-size: .85rem; }
:focus-visible { outline: 3px solid var(--primary); outline-offset: 3px; }
@media (min-width: 900px) {
  #stage { top: 0; right: 0; left: auto; width: calc(100% - 36rem); height: 100%; }
  .hero { min-height: 100vh; display: flex; align-items: center; padding-top: 6rem; padding-left: max(2rem, calc((100vw - 72rem) / 2 + .9rem)); }
}
@media (max-width: 640px) {
  .nav nav { display: none; }
  .hero { padding-left: 1rem; padding-right: 1rem; }
  .details { padding: 2rem 1rem 3rem; }
}
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`;
}

/** Write the site into outDir. Returns the list of files written. */
export function writeSite(scene, outDir, { threeSrc }) {
  if (!threeSrc || !fs.existsSync(threeSrc)) {
    throw new Error(`three.js was not found at ${threeSrc}. Run "npm install" in the project folder first.`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const files = [];
  const put = (name, write) => {
    const target = path.join(outDir, name);
    write(target);
    files.push(target);
  };
  put('index.html', (t) => fs.writeFileSync(t, renderIndexHtml(scene)));
  put('style.css', (t) => fs.writeFileSync(t, renderCss(scene)));
  put('main.js', (t) => fs.copyFileSync(path.join(here, 'site', 'main.js'), t));
  put('runtime.js', (t) => fs.copyFileSync(path.join(here, 'runtime.js'), t));
  put('three.module.min.js', (t) => fs.copyFileSync(threeSrc, t));
  return files;
}
