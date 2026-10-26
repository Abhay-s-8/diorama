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
  const cards = scene.sections
    .map((s) => `        <section class="card">\n          <h2>${escapeHtml(s.heading)}</h2>\n          <p>${escapeHtml(s.text)}</p>\n        </section>`)
    .join('\n');
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
  <main class="content">
    <article class="window">
      <div class="titlebar"><span class="dots" aria-hidden="true"></span>${escapeHtml(scene.title)}</div>
      <div class="body">
        <p class="badge">${escapeHtml(scene.mood)}</p>
        <h1>${escapeHtml(scene.title)}</h1>
${cards}
      </div>
    </article>
  </main>
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
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--accent); font-family: "Courier New", ui-monospace, monospace; image-rendering: pixelated; }
#stage { position: fixed; inset: 0; width: 100%; height: 100%; display: block; image-rendering: pixelated; }
.content { position: relative; z-index: 1; min-height: 100%; padding: 2rem 1.5rem; display: flex; align-items: flex-start; pointer-events: none; }
.window {
  pointer-events: auto;
  width: 100%;
  max-width: 26rem;
  background: var(--bg);
  color: var(--accent);
  box-shadow:
    0 -4px 0 0 var(--accent),
    0 4px 0 0 var(--accent),
    -4px 0 0 0 var(--accent),
    4px 0 0 0 var(--accent),
    8px 8px 0 0 var(--primary);
}
.titlebar { display: flex; align-items: center; gap: .75rem; padding: .5rem .75rem; background: var(--accent); color: var(--bg); font-weight: bold; letter-spacing: .08em; text-transform: uppercase; font-size: .8rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.dots { width: 8px; height: 8px; background: var(--bg); box-shadow: 14px 0 0 0 var(--bg), 28px 0 0 0 var(--bg); margin-right: 28px; flex: none; }
.body { padding: 1.25rem; }
.badge { display: inline-block; margin: 0 0 1rem; padding: .15rem .5rem; background: var(--primary); color: var(--bg); text-transform: uppercase; letter-spacing: .15em; font-size: .7rem; font-weight: bold; box-shadow: 4px 4px 0 0 var(--accent); }
h1 { margin: 0 0 1.25rem; font-size: clamp(1.4rem, 4vw, 2rem); line-height: 1.15; color: var(--primary); text-transform: uppercase; letter-spacing: .04em; }
.card { margin-bottom: 1rem; padding: .75rem .9rem; box-shadow: 0 0 0 4px var(--accent), 8px 8px 0 4px var(--primary); }
.card:last-child { margin-bottom: 0; }
h2 { margin: 0 0 .35rem; font-size: 1rem; color: var(--primary); text-transform: uppercase; letter-spacing: .06em; }
p { margin: 0; line-height: 1.5; font-size: .9rem; }
@media (min-width: 900px) {
  #stage { left: 30rem; width: calc(100% - 30rem); }
}
@media (max-width: 640px) {
  .content { padding: 1rem; align-items: flex-end; }
  .window { max-width: none; }
}
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
