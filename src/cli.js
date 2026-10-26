#!/usr/bin/env node
/* img2scene command line interface. Exit codes: 0 ok, 1 unexpected, 2 bad input, 3 Ollama problem. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describeImage } from './describe.js';
import { writeSite } from './generate.js';
import { DEFAULT_HOST, DEFAULT_MODEL, OllamaError } from './ollama.js';
import { FALLBACK_SCENE, validateScene } from './schema.js';

const IMAGE_TYPES = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_THREE = fileURLToPath(new URL('../node_modules/three/build/three.module.min.js', import.meta.url));

const USAGE = `Usage: img2scene <image> [options]
       img2scene --demo [options]
       img2scene --scene scene.json [options]

Options:
  --model NAME   Ollama vision model (default ${DEFAULT_MODEL})
  --host URL     Ollama server (default ${DEFAULT_HOST})
  --out DIR      output folder (default out/<image name>)
  --print-json   print the scene JSON and write nothing
  --demo         build a page from the built-in scene (no image, no model)
  --scene FILE   build a page from a scene JSON file (no image, no model)
  --three PATH   path to three.module.min.js (default: node_modules/three)
  --help         show this help`;

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { model: DEFAULT_MODEL, host: DEFAULT_HOST, out: null, scene: null, printJson: false, demo: false, three: DEFAULT_THREE, help: false };
  const positional = [];
  const needValue = new Set(['--model', '--host', '--out', '--three', '--scene']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (needValue.has(a)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new UsageError(`Missing value for ${a}.`);
      opts[a.slice(2)] = v;
    } else if (a === '--print-json') opts.printJson = true;
    else if (a === '--demo') opts.demo = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a.startsWith('--')) throw new UsageError(`Unknown option ${a}.`);
    else positional.push(a);
  }
  if (!opts.help) {
    if (positional.length > 1) throw new UsageError('Expected one image, got several.');
    if (!opts.demo && !opts.scene && positional.length === 0) throw new UsageError('Missing image. Pass an image file, or use --demo or --scene.');
  }
  return { opts, image: positional[0] };
}

export async function main(argv, { out = process.stdout, err = process.stderr, describeFn = describeImage, cwd = process.cwd() } = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    err.write(`img2scene: ${e.message}\n${USAGE}\n`);
    return 2;
  }
  const { opts, image } = parsed;
  if (opts.help) {
    out.write(`${USAGE}\n`);
    return 0;
  }

  try {
    let scene;
    let name = 'demo';
    if (opts.scene) {
      let raw;
      try {
        raw = JSON.parse(fs.readFileSync(opts.scene, 'utf8'));
      } catch (e) {
        const why = e instanceof SyntaxError ? `it is not valid JSON (${e.message})` : 'it could not be read';
        err.write(`img2scene: cannot use scene file ${opts.scene}: ${why}\n`);
        return 2;
      }
      const checked = validateScene(raw);
      for (const w of checked.warnings) err.write(`warning: ${w}\n`);
      scene = checked.scene;
      name = path.basename(opts.scene, path.extname(opts.scene));
    } else if (opts.demo) {
      scene = JSON.parse(JSON.stringify(FALLBACK_SCENE));
    } else {
      const ext = path.extname(image).toLowerCase();
      if (!IMAGE_TYPES.includes(ext)) {
        err.write(`img2scene: unsupported file type "${ext || image}". Use png, jpg, jpeg, webp or gif.\n`);
        return 2;
      }
      let size;
      try {
        size = fs.statSync(image).size;
      } catch {
        err.write(`img2scene: cannot read image ${image}\n`);
        return 2;
      }
      if (size > MAX_IMAGE_BYTES) {
        err.write('img2scene: the image is larger than 10 MB. Use a smaller one.\n');
        return 2;
      }
      name = path.basename(image, path.extname(image));
      const imageBase64 = fs.readFileSync(image).toString('base64');
      const result = await describeFn({ imageBase64, model: opts.model, host: opts.host });
      for (const w of result.warnings) err.write(`warning: ${w}\n`);
      if (result.usedFallback) err.write('warning: the default scene was used instead of a description of your image.\n');
      scene = result.scene;
    }

    if (opts.printJson) {
      out.write(`${JSON.stringify(scene, null, 2)}\n`);
      return 0;
    }

    const outDir = path.resolve(cwd, opts.out ?? path.join('out', name));
    try {
      writeSite(scene, outDir, { threeSrc: opts.three });
    } catch (e) {
      if (/npm install/.test(e.message)) {
        err.write(`img2scene: ${e.message}\n`);
        return 2;
      }
      throw e;
    }
    out.write(`Wrote ${path.join(outDir, 'index.html')}\n`);
    out.write('Open it with the VS Code "Live Server" extension (right-click index.html), or run: npx http-server ' + outDir + '\n');
    return 0;
  } catch (e) {
    if (e instanceof OllamaError) {
      err.write(`img2scene: ${e.message}\n`);
      return 3;
    }
    err.write(`img2scene: ${e.message}\n`);
    return 1;
  }
}

const invokedDirectly = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
