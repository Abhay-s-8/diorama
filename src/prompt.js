import { ANIMATIONS, LIMITS, MOODS, SHAPES } from './schema.js';

/** JSON schema passed to Ollama's `format` so the model is steered towards valid output. */
export const SCENE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    mood: { type: 'string', enum: MOODS },
    palette: {
      type: 'object',
      properties: {
        background: { type: 'string' },
        primary: { type: 'string' },
        accent: { type: 'string' },
      },
      required: ['background', 'primary', 'accent'],
    },
    objects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          shape: { type: 'string', enum: SHAPES },
          color: { type: 'string' },
          position: { type: 'array', items: { type: 'number' } },
          size: { type: 'number' },
          animation: { type: 'string', enum: ANIMATIONS },
        },
        required: ['shape', 'color', 'position', 'size', 'animation'],
      },
    },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: { heading: { type: 'string' }, text: { type: 'string' } },
        required: ['heading', 'text'],
      },
    },
  },
  required: ['title', 'mood', 'palette', 'objects'],
};

export function buildPrompt({ previousError } = {}) {
  const lines = [];
  if (previousError) {
    lines.push(
      `Your previous answer was not valid JSON (${previousError}). Try again and reply with ONLY valid JSON.`,
      '',
    );
  }
  lines.push(
    'Look at the image and describe it as a simple 3D scene for a small website.',
    'Reply with ONLY a JSON object, no explanation and no markdown.',
    '',
    'Rules:',
    `- title: a short name for the page (max ${LIMITS.title} characters).`,
    `- mood: one of ${MOODS.join(', ')}.`,
    '- palette: background, primary and accent as #rrggbb colours taken from the image.',
    `- objects: 3 to ${LIMITS.objects} simple shapes that suggest the main things in the image.`,
    `  shape is one of ${SHAPES.join(', ')}.`,
    `  position is [x, y, z] with each value between -${LIMITS.position} and ${LIMITS.position}.`,
    `  size is a number between ${LIMITS.minSize} and ${LIMITS.maxSize}.`,
    `  animation is one of ${ANIMATIONS.join(', ')}.`,
    `- sections: up to ${LIMITS.sections} items with a short heading and one sentence of text about the image.`,
    'Describe only what you can see. Do not invent brands or text.',
  );
  return lines.join('\n');
}
