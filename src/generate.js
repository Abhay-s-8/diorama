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
  const count = scene.sections.length;
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
      <footer class="statusbar"><span>${count} ${count === 1 ? 'section' : 'sections'}</span><span>Made with Diorama</span></footer>
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
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--accent); font-family: var(--mono); image-rendering: pixelated; }
#stage { position: fixed; inset: 0; width: 100%; height: 100%; display: block; image-rendering: pixelated; }
.content { position: relative; z-index: 1; min-height: 100%; padding: 2rem 1.5rem; display: flex; align-items: flex-start; pointer-events: none; }
.window {
  pointer-events: auto;
  width: 100%;
  max-width: 26rem;
  background: var(--bg);
  color: var(--accent);
  box-shadow:
    0 -3px 0 0 var(--accent),
    0 3px 0 0 var(--accent),
    -3px 0 0 0 var(--accent),
    3px 0 0 0 var(--accent),
    8px 8px 0 0 var(--primary);
}
.titlebar { display: flex; align-items: center; gap: .75rem; padding: .55rem .9rem; background: var(--accent); color: var(--bg); font-weight: bold; letter-spacing: .06em; font-size: .8rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.dots { width: 8px; height: 8px; background: var(--bg); box-shadow: 14px 0 0 0 var(--bg), 28px 0 0 0 var(--bg); margin-right: 28px; flex: none; }
.body { padding: 1.5rem 1.4rem 1.6rem; font-family: var(--sans); }
.badge { display: inline-block; margin: 0 0 .9rem; padding: .15rem .55rem; background: var(--primary); color: var(--bg); font-family: var(--mono); letter-spacing: .08em; font-size: .75rem; font-weight: bold; box-shadow: 3px 3px 0 0 var(--accent); }
h1 { margin: 0 0 1.6rem; font-family: var(--mono); font-size: clamp(1.6rem, 4.5vw, 2.2rem); line-height: 1.1; letter-spacing: -.01em; color: var(--primary); }
.card { margin-bottom: 1.4rem; padding: .9rem 1rem 1rem; background: var(--panel); box-shadow: 0 0 0 2px var(--accent), 6px 6px 0 2px var(--primary); }
.card:last-child { margin-bottom: 0; }
h2 { margin: 0 0 .4rem; display: flex; align-items: center; gap: .55rem; font-family: var(--mono); font-size: 1rem; line-height: 1.25; color: var(--primary); }
h2::before { content: ""; width: 8px; height: 8px; flex: none; background: var(--primary); box-shadow: 2px 2px 0 0 var(--accent); }
p { margin: 0; max-width: 62ch; line-height: 1.6; font-size: .95rem; color: var(--muted); }
.card p { color: var(--accent); }
.statusbar { display: flex; justify-content: space-between; gap: 1rem; padding: .5rem .9rem; border-top: 2px solid var(--accent); font-family: var(--mono); font-size: .72rem; color: var(--muted); }
:focus-visible { outline: 3px solid var(--primary); outline-offset: 3px; }
@media (min-width: 900px) {
  #stage { left: 30rem; width: calc(100% - 30rem); }
  .window { min-height: calc(100vh - 4rem); display: flex; flex-direction: column; }
  .body { flex: 1; }
}
@media (max-width: 640px) {
  .content { padding: 1.25rem 1rem; padding-top: 46vh; align-items: flex-end; }
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
