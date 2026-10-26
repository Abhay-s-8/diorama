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
  const sections = scene.sections
    .map((s) => `      <section>\n        <h2>${escapeHtml(s.heading)}</h2>\n        <p>${escapeHtml(s.text)}</p>\n      </section>`)
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
    <header>
      <h1>${escapeHtml(scene.title)}</h1>
      <p class="mood">${escapeHtml(scene.mood)}</p>
    </header>
${sections}
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
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--accent); font-family: system-ui, sans-serif; }
#stage { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
.content { position: relative; z-index: 1; max-width: 42rem; padding: 2rem 1.5rem; pointer-events: none; }
h1 { margin: 0 0 .25rem; font-size: clamp(1.8rem, 5vw, 3rem); color: var(--primary); }
.mood { margin: 0 0 2rem; text-transform: uppercase; letter-spacing: .15em; font-size: .8rem; opacity: .7; }
section { margin-bottom: 1.5rem; }
h2 { margin: 0 0 .25rem; font-size: 1.2rem; color: var(--primary); }
p { margin: 0; line-height: 1.5; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
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
