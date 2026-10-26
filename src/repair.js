/* Small models wrap JSON in chatter and fences. Pull the object out and parse it. */

function stripFences(text) {
  return text.replace(/```[a-zA-Z]*\s*/g, '').replace(/```/g, '');
}

/** First top-level {...} in the text, respecting strings. Returns null if none or unclosed. */
export function extractJsonText(text) {
  if (typeof text !== 'string') return null;
  const s = stripFences(text.replace(/^\uFEFF/, ''));
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

/** Remove trailing commas outside of strings. */
function dropTrailingCommas(json) {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === ',') {
      let j = i + 1;
      while (j < json.length && /\s/.test(json[j])) j++;
      if (json[j] !== '}' && json[j] !== ']') out += ch;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Returns { ok: true, value } or { ok: false, error }. */
export function parseJsonLoose(text) {
  if (typeof text !== 'string') return { ok: false, error: 'The answer was not text.' };
  const candidate = extractJsonText(text);
  if (candidate === null) {
    const hasOpen = stripFences(text).includes('{');
    return {
      ok: false,
      error: hasOpen
        ? 'The JSON was incomplete (truncated or unbalanced braces).'
        : 'No JSON object found in the answer.',
    };
  }
  try {
    return { ok: true, value: JSON.parse(dropTrailingCommas(candidate)) };
  } catch (e) {
    return { ok: false, error: `The JSON was not valid: ${e.message}` };
  }
}
