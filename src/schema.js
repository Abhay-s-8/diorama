/* Scene format and validation. Everything the model says passes through here. */

export const SHAPES = ['box', 'sphere', 'cylinder', 'cone', 'torus'];
export const ANIMATIONS = ['none', 'spin', 'float', 'pulse'];
export const MOODS = ['calm', 'energetic', 'dark', 'playful', 'elegant'];

export const LIMITS = {
  title: 60,
  heading: 60,
  text: 240,
  objects: 12,
  sections: 4,
  position: 5,
  minSize: 0.2,
  maxSize: 3,
};

export const FALLBACK_SCENE = Object.freeze({
  title: 'Untitled scene',
  mood: 'calm',
  palette: { background: '#101820', primary: '#f2aa4c', accent: '#e0e0e0' },
  objects: [
    { shape: 'box', color: '#f2aa4c', position: [-2, 0, 0], size: 1.2, animation: 'spin' },
    { shape: 'sphere', color: '#e0e0e0', position: [0, 0.5, 0], size: 1.4, animation: 'float' },
    { shape: 'torus', color: '#4c9ff2', position: [2, 0, 0], size: 1.2, animation: 'pulse' },
  ],
  sections: [],
});

const clone = (v) => JSON.parse(JSON.stringify(v));
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function hex(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return null;
}

function num(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Returns { scene, warnings, fallback }. Never throws; never mutates its input. */
export function validateScene(raw) {
  const warnings = [];
  if (!isPlainObject(raw)) {
    return { scene: clone(FALLBACK_SCENE), warnings: ['The model did not return a scene object.'], fallback: true };
  }

  const title = cleanText(raw.title, LIMITS.title) || FALLBACK_SCENE.title;

  let mood = raw.mood;
  if (!MOODS.includes(mood)) {
    warnings.push(`Unknown mood ${JSON.stringify(mood)}; using "calm".`);
    mood = 'calm';
  }

  const palette = {};
  const rawPalette = isPlainObject(raw.palette) ? raw.palette : {};
  for (const key of ['background', 'primary', 'accent']) {
    const c = hex(rawPalette[key]);
    if (!c) warnings.push(`Palette ${key} is missing or not a #rrggbb colour; using the default.`);
    palette[key] = c || FALLBACK_SCENE.palette[key];
  }

  const objects = [];
  const rawObjects = Array.isArray(raw.objects) ? raw.objects : [];
  for (const o of rawObjects) {
    if (!isPlainObject(o) || !SHAPES.includes(o.shape)) {
      warnings.push(`Dropped an object with unknown shape ${JSON.stringify(isPlainObject(o) ? o.shape : o)}.`);
      continue;
    }
    const rawColor = hex(o.color);
    if (!rawColor) warnings.push(`An object had no valid colour; using the primary colour.`);
    const color = rawColor || palette.primary;
    const p = Array.isArray(o.position) ? o.position.map(num) : [];
    const validPosition = p.length === 3 && p.every((n) => n !== null);
    const position = validPosition ? p.map((n) => clamp(n, -LIMITS.position, LIMITS.position)) : [0, 0, 0];
    if (!validPosition) warnings.push(`A ${o.shape} had an invalid position; placed at the centre.`);
    else if (position.some((n, k) => n !== p[k])) warnings.push(`A ${o.shape} position was outside the stage; clamped.`);
    const s = num(o.size);
    const size = s === null ? 1 : clamp(s, LIMITS.minSize, LIMITS.maxSize);
    if (s === null) warnings.push(`A ${o.shape} had no valid size; using 1.`);
    else if (size !== s) warnings.push(`A ${o.shape} size was out of range; clamped.`);
    const animation = ANIMATIONS.includes(o.animation) ? o.animation : 'none';
    objects.push({ shape: o.shape, color, position, size, animation });
  }
  if (objects.length > LIMITS.objects) {
    warnings.push(`Too many objects; kept the first ${LIMITS.objects}.`);
    objects.length = LIMITS.objects;
  }
  let fallback = false;
  if (objects.length === 0) {
    warnings.push('The scene had no valid objects; using the default objects.');
    objects.push(...clone(FALLBACK_SCENE.objects));
    fallback = true;
  }

  const sections = [];
  for (const sec of Array.isArray(raw.sections) ? raw.sections : []) {
    if (!isPlainObject(sec)) continue;
    const heading = cleanText(sec.heading, LIMITS.heading);
    const text = cleanText(sec.text, LIMITS.text);
    if (!heading && !text) continue;
    sections.push({ heading, text });
    if (sections.length === LIMITS.sections) break;
  }

  return { scene: { title, mood, palette, objects, sections }, warnings, fallback };
}
