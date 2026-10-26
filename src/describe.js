import { chatVision } from './ollama.js';
import { SCENE_JSON_SCHEMA, buildPrompt } from './prompt.js';
import { parseJsonLoose } from './repair.js';
import { FALLBACK_SCENE, validateScene } from './schema.js';

/**
 * Ask the vision model for a scene. One retry if the JSON is unusable, then a default scene.
 * Ollama errors (unreachable, missing model, timeout) are NOT swallowed.
 */
export async function describeImage({ imageBase64, model, host, fetchImpl, timeoutMs }) {
  const ask = (previousError) =>
    chatVision({ host, model, imageBase64, fetchImpl, timeoutMs, schema: SCENE_JSON_SCHEMA, prompt: buildPrompt({ previousError }) });

  let parsed = parseJsonLoose(await ask());
  let retries = 0;
  if (!parsed.ok) {
    retries = 1;
    parsed = parseJsonLoose(await ask(parsed.error));
  }

  if (!parsed.ok) {
    return {
      scene: JSON.parse(JSON.stringify(FALLBACK_SCENE)),
      warnings: [`The model did not return usable JSON (${parsed.error}); using the default scene.`],
      retries,
      usedFallback: true,
    };
  }
  const { scene, warnings, fallback } = validateScene(parsed.value);
  return { scene, warnings, retries, usedFallback: fallback };
}
