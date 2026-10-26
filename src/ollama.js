/* Minimal Ollama client for one vision request. Runs in Node, so no browser CORS issues. */

export const DEFAULT_HOST = 'http://localhost:11434';
export const DEFAULT_MODEL = 'gemma3:4b';
const DEFAULT_TIMEOUT_MS = 180000; // local vision models on CPU can take a while

export class OllamaError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'OllamaError';
    this.kind = kind; // unreachable | timeout | model_missing | http | empty
  }
}

export function normalizeBaseUrl(url) {
  const raw = String(url ?? '').trim();
  if (!raw) return DEFAULT_HOST;
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  const looksLikeHostPort = /^[^/:]+:\d+/.test(raw);
  const withScheme = hasScheme ? raw : /^[a-z][a-z0-9+.-]*:/i.test(raw) && !looksLikeHostPort ? raw : `http://${raw}`;
  if (!/^https?:\/\//i.test(withScheme)) throw new Error('The Ollama host must start with http:// or https://');
  return withScheme.replace(/\/+$/, '');
}

async function detail(res) {
  try {
    return (await res.json())?.error || '';
  } catch {
    return '';
  }
}

/** Send one image + prompt; returns the model's text. */
export async function chatVision({
  host,
  model,
  prompt,
  imageBase64,
  schema,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!model) throw new Error('A model name is required.');
  if (!imageBase64) throw new Error('An image is required.');
  const base = normalizeBaseUrl(host);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetchImpl(`${base}/api/chat`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: schema,
        messages: [{ role: 'user', content: prompt, images: [imageBase64] }],
        options: { temperature: 0.2 },
      }),
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new OllamaError('timeout', `Ollama took longer than ${Math.round(timeoutMs / 1000)} s to answer. Try a smaller model.`);
    }
    throw new OllamaError('unreachable', `Could not reach Ollama at ${base}. Is it running? Start it with "ollama serve".`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const d = await detail(res);
    if (res.status === 404 && /not found/i.test(d)) {
      throw new OllamaError('model_missing', `The model "${model}" is not installed. Run: ollama pull ${model}`);
    }
    const hint = res.status === 400 && /image|vision/i.test(d) ? ' Is this a vision-capable model?' : '';
    throw new OllamaError('http', `Ollama returned ${res.status}${d ? ` — ${d}` : ''}.${hint}`);
  }

  const data = await res.json();
  const text = data?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new OllamaError('empty', 'Ollama returned an empty answer.');
  return text;
}
