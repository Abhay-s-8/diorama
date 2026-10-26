/* Turns a validated scene into a small static website. Model text is always untrusted. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  <canvas id="stage" aria-hidden="true"></canvas>
  <header class="nav" id="top">
    <a class="brand" href="#top"><span class="logo" aria-hidden="true"></span>Diorama</a>
    <nav aria-label="Page sections"><a href="#top" aria-current="page">Home</a>${links}</nav>
    <span class="badge">${escapeHtml(scene.mood)}</span>
  </header>
  <main>
    <section class="hero">
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
  return `:root {
  --bg: ${palette.background};
  --primary: ${palette.primary};
  --accent: ${palette.accent};
  --panel: var(--bg);
  --muted: var(--accent);
  --mono: "Courier New", ui-monospace, monospace;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
@supports (color: color-mix(in srgb, red 50%, blue)) {
  :root {
    --panel: color-mix(in srgb, var(--bg) 90%, var(--accent));
    --muted: color-mix(in srgb, var(--accent) 80%, var(--bg));
  }
}
* { box-sizing: border-box; }
html { background: var(--bg); scroll-padding-top: 6rem; }
body { margin: 0; background: var(--bg); color: var(--accent); font-family: var(--sans); image-rendering: pixelated; }
#stage { position: fixed; top: 5.5rem; left: 0; width: 100%; height: 36vh; display: block; image-rendering: pixelated; }
.nav { position: fixed; top: .75rem; left: .75rem; right: .75rem; z-index: 5; max-width: 76rem; margin-inline: auto; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .55rem .8rem; background: var(--panel); box-shadow: 0 0 0 2px var(--accent), 5px 5px 0 2px var(--primary); }
.brand { display: flex; align-items: center; font-family: var(--mono); font-weight: bold; color: var(--accent); text-decoration: none; }
.logo { display: inline-block; width: 14px; height: 14px; margin-right: .6rem; background: var(--primary); box-shadow: 3px 3px 0 0 var(--accent); }
.nav nav { display: flex; gap: .25rem; min-width: 0; }
.nav nav a { display: inline-block; max-width: 9rem; padding: .3rem .65rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: .85rem; color: var(--accent); text-decoration: none; }
.nav nav a:hover, .nav nav a[aria-current] { background: var(--primary); color: var(--bg); }
.badge { flex: none; padding: .15rem .55rem; background: var(--primary); color: var(--bg); font-family: var(--mono); font-size: .75rem; font-weight: bold; letter-spacing: .04em; box-shadow: 3px 3px 0 0 var(--accent); }
.hero { position: relative; z-index: 1; padding: 3rem 1.5rem; padding-top: calc(5.5rem + 36vh + 1.5rem); }
.hero-copy { max-width: 34rem; }
h1 { margin: 0; font-family: var(--mono); line-height: 1.1; }
.lead { display: block; margin-bottom: .9rem; font-size: clamp(1.3rem, 3.4vw, 1.9rem); color: var(--accent); }
.plate { display: inline-block; max-width: 100%; padding: .1em .4em; font-size: clamp(2rem, 7vw, 3.6rem); color: var(--primary); background: var(--panel); box-shadow: 0 0 0 3px var(--accent), 7px 7px 0 3px var(--primary); overflow-wrap: anywhere; }
.actions { display: flex; flex-wrap: wrap; gap: 1.1rem; margin-top: 2.2rem; }
.btn { display: inline-block; padding: .75rem 1.2rem; font-family: var(--mono); font-size: .9rem; font-weight: bold; color: var(--accent); background: transparent; text-decoration: none; box-shadow: 0 0 0 2px var(--accent), 4px 4px 0 2px var(--accent); transition: transform .1s; }
.btn.primary { background: var(--primary); color: var(--bg); }
.btn:hover { transform: translate(2px, 2px); box-shadow: 0 0 0 2px var(--accent), 2px 2px 0 2px var(--accent); }
.details { position: relative; z-index: 2; padding: 3.5rem 1.5rem 4rem; background: var(--bg); border-top: 3px solid var(--accent); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 2rem; max-width: 72rem; margin: 0 auto; }
.card { padding: .9rem 1rem 1rem; background: var(--panel); box-shadow: 0 0 0 2px var(--accent), 6px 6px 0 2px var(--primary); }
h2 { margin: 0 0 .4rem; display: flex; align-items: center; gap: .55rem; font-family: var(--mono); font-size: 1.05rem; line-height: 1.25; color: var(--primary); }
h2::before { content: ""; width: 8px; height: 8px; flex: none; background: var(--primary); box-shadow: 2px 2px 0 0 var(--accent); }
p { margin: 0; max-width: 62ch; line-height: 1.6; font-size: .95rem; }
.about { position: relative; z-index: 2; padding: 1.2rem 1.5rem; background: var(--bg); border-top: 2px solid var(--accent); }
.about p { max-width: 72rem; margin: 0 auto; font-size: .8rem; color: var(--muted); }
:focus-visible { outline: 3px solid var(--primary); outline-offset: 3px; }
@media (min-width: 900px) {
  #stage { top: 0; left: 38rem; width: calc(100% - 38rem); height: 100vh; }
  .hero { min-height: 100vh; display: flex; align-items: center; padding-top: 6rem; padding-left: max(2rem, calc((100vw - 76rem) / 2 + .75rem)); }
}
@media (max-width: 640px) {
  .nav nav { display: none; }
  .hero { padding-left: 1rem; padding-right: 1rem; }
  .details { padding: 2.5rem 1rem 3rem; }
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
