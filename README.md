# Diorama

Turn an image into a small 3D website, using a **local** vision model.

A vision model running in [Ollama](https://ollama.com) looks at your picture and describes it as a
simple scene (shapes, colours, layout, a title). The code validates that description and writes a
one-page website with a rotating [Three.js](https://threejs.org) scene.

Built for the Hacktoberfest 2026 Week 4 DEV Challenge. The repository was started on 2026-10-26.

## Live demo

https://abhay-s-8.github.io/diorama/

This page is built by GitHub Actions from `examples/demo-scene.json` (a hand-written scene, not model
output) every time `main` changes, after the tests pass. The CLI itself needs a local Ollama, so only this
demo is hosted.

## Why a local open-weight model

- Your sketches and brand images never leave your machine.
- It works offline once the model is pulled.
- The model is swappable: `--model gemma3:4b`, `--model qwen2.5vl`, anything Ollama serves that accepts images.

## Quick start

Requirements: Node.js 20+, [Ollama](https://ollama.com).

```bash
ollama pull gemma3:4b      # a vision-capable model; use a smaller one if RAM is tight
npm install                # installs three.js, the only dependency
npm test                   # all tests run without a model or network

npm run demo               # builds out/demo from examples/demo-scene.json (no model needed)
node src/cli.js examples/my-sketch.png
```

Open the generated `out/<name>/index.html` with the VS Code **Live Server** extension
(right-click, "Open with Live Server") or run `npx http-server out/<name>`.
Browsers block ES modules on `file://`, so double-clicking the file will not work.

## Options

| Option | Meaning |
|---|---|
| `<image>` | png, jpg, jpeg, webp or gif, up to 10 MB |
| `--model NAME` | Ollama vision model (default `gemma3:4b`) |
| `--host URL` | Ollama server (default `http://localhost:11434`) |
| `--out DIR` | Output folder (default `out/<image name>`) |
| `--print-json` | Print the validated scene JSON and write nothing |
| `--demo` | Use the built-in scene, no image and no model |
| `--scene FILE` | Build a page from a scene JSON file, no image and no model |
| `--three PATH` | Path to `three.module.min.js` (default: from `node_modules`) |

Exit codes: `0` ok, `1` unexpected error, `2` bad input, `3` Ollama problem
(not running, model not installed, timeout).

## How it works

```
image -> ollama.js (vision model, JSON schema) -> repair.js -> schema.js (validate) -> generate.js -> out/<name>/
                                                                ^ default scene if the model's JSON is unusable
```

- `src/ollama.js` sends the image (base64) and a JSON schema to Ollama's `/api/chat`.
- `src/repair.js` pulls the JSON out of chatty or fenced answers and tolerates trailing commas.
- `src/describe.js` retries once, telling the model what was wrong, then falls back to a default scene and says so.
- `src/schema.js` is the only gate between model output and the page: it limits shapes, clamps numbers,
  checks colours and caps text lengths.
- `src/generate.js` writes `index.html`, `style.css`, `main.js`, `runtime.js` and a copy of three.js.
  The page is a small landing page: a floating glass top bar, a hero with the title in an outlined box and two
  buttons, the 3D canvas beside it (above it on phones), then one card per section. The look is a soft
  gradient built from the scene's palette with rounded glass cards, inspired by a Dribbble landing page shot
  (3D Modeling for UI Design, by Mako Tsereteli); none of its art, branding or text is used. Text colours are
  worked out from the background (`src/color.js`), so a model palette with poor contrast cannot make the page
  unreadable. It is plain CSS with no fonts, images or network requests, so it keeps the strict CSP and works offline.

## Safety

Everything the model writes is treated as untrusted. Text is HTML-escaped, colours must be `#rrggbb`,
the scene JSON is embedded so it cannot close its own `<script>` tag, and the page ships with a strict
Content-Security-Policy (no network access, no inline scripts).

## Tests

```bash
npm test
```

Tests were written before the code. A fake Ollama server (an injected `fetch`) and a stub of three.js
mean no test needs a real model, GPU or network.

## Status and limits

Be honest about what is and is not checked.

- Checked: validation, repair, the Ollama request/response handling, the generator output and the CLI
  (unit tests). The live demo page renders with the real three.js in a real browser, with no console
  errors, and hostile titles stay inert (tested with a stub of three.js).
- **Not yet checked: output from a real vision model.** That needs a machine with Ollama (see
  `docs/PLAN.md`, Days 3 and 4). The 3D layout is only tuned on the hand-written demo scene so far.
- The result is a **stylised scene from basic shapes**, not an accurate 3D model of what is in the photo.
  Real image-to-3D models need a GPU and are out of scope here.
- Small vision models sometimes return poor JSON or odd shapes. The repair/retry/fallback layer reduces
  this but cannot remove it.

## Credits

- [three.js](https://github.com/mrdoob/three.js), MIT licence.
- [Ollama](https://github.com/ollama/ollama) and the vision model you choose (check that model's licence).
- The page layout is inspired by a Dribbble shot (see above) but written from scratch in plain CSS; no assets from it are used.
- No code was copied from other projects.
- AI assistance (Claude) was used while writing this project.

## Late commits

Commits made after the challenge deadline (if any) are listed here: none so far.

## Licence

MIT, see `LICENSE`.
