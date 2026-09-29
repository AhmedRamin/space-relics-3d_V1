/**
 * Language-model providers.
 *
 * Priority:
 *   1. AI_API_KEY        — any OpenAI-compatible endpoint (paid or self-hosted)
 *   2. FREE_MODEL_URL    — a keyless free endpoint (default: Pollinations text API)
 *   3. none              — the guide still answers, entirely from the dataset + web text
 *
 * The model is only ever asked to *reword* text that was already retrieved. It never
 * supplies facts, and no key ever reaches the browser.
 */

const SYSTEM_PROMPT = [
  'You are the guide inside "Space Relics", a 3D Solar System explorer for students.',
  'Rewrite the retrieved material into a clear, friendly reply of at most three short paragraphs.',
  'Use ONLY the provided material. Never add names, dates, numbers or mission facts that are not in it.',
  'If the material says something is unknown or unavailable, say that instead of guessing.',
].join(' ');

const paidConfigured = () => Boolean(process.env.AI_API_KEY);

/**
 * The keyless free endpoint rate-limits aggressively (HTTP 429 "queue full"), so after
 * a few consecutive failures we stop calling it for a cooldown window instead of adding
 * latency to every single question.
 */
const cooldownMs = () => Number(process.env.FREE_MODEL_COOLDOWN_MS || 120000);
const failures = { count: 0, until: 0 };

function freeAvailable() {
  return freeEnabled() && Date.now() > failures.until;
}

function noteFailure() {
  failures.count += 1;
  if (failures.count >= 2) {
    failures.until = Date.now() + cooldownMs();
    // eslint-disable-next-line no-console
    console.warn(`[model] free provider cooling down for ${Math.round(cooldownMs() / 1000)}s`);
  }
}

function noteSuccess() {
  failures.count = 0;
  failures.until = 0;
}
const freeUrl = () => process.env.FREE_MODEL_URL || 'https://text.pollinations.ai/openai';
const freeEnabled = () => process.env.FREE_MODEL !== 'false';
const freeModelName = () => process.env.FREE_MODEL_NAME || 'openai';

/** Which providers are usable right now (used by /api/health and the UI). */
function describe() {
  return {
    paid: paidConfigured() ? process.env.AI_MODEL || 'gpt-4o-mini' : null,
    free: freeAvailable() ? freeModelName() : null,
    freeCoolingDown: freeEnabled() && !freeAvailable(),
    any: paidConfigured() || freeEnabled(),
  };
}

async function post(url, body, headers, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`provider ${res.status} ${detail.slice(0, 120)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** OpenAI-compatible chat completion. */
async function chatCompletion({ baseUrl, apiKey, model, messages, timeoutMs = 14000 }) {
  const base = String(baseUrl).replace(/\/$/, '');
  const data = await post(
    `${base}/chat/completions`,
    { model, temperature: 0.2, max_tokens: 420, messages },
    apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    timeoutMs
  );
  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error('empty completion');
  return text.trim();
}

/**
 * Rewords retrieved material.
 * @returns {Promise<{text: string, provider: string} | null>}
 */
async function reword({ question, material, history = [] }) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: `RETRIEVED MATERIAL:\n${material}\n\nVISITOR QUESTION: ${question}` },
  ];

  if (paidConfigured()) {
    try {
      const text = await chatCompletion({
        baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
        apiKey: process.env.AI_API_KEY,
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages,
      });
      return { text, provider: 'paid' };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[model] paid provider failed:', err.message);
    }
  }

  if (freeAvailable()) {
    try {
      const text = await chatCompletion({
        baseUrl: freeUrl(),
        apiKey: null,
        model: freeModelName(),
        messages,
        timeoutMs: 9000,
      });
      noteSuccess();
      return { text, provider: 'free' };
    } catch (err) {
      noteFailure();
      // eslint-disable-next-line no-console
      console.warn('[model] free provider failed:', err.message);
    }
  }

  return null;
}

module.exports = { reword, describe, paidConfigured, freeEnabled };
