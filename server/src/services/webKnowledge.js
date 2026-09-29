/**
 * Internet knowledge, keyless.
 *
 * Uses the public Wikipedia search + summary REST API. No API key, no account, and the
 * whole call is wrapped so an offline machine simply gets `used: false` instead of an
 * error. Results are cached in memory with a TTL so repeated questions are free.
 */

const STOPWORDS = new Set([
  'what', 'which', 'where', 'when', 'why', 'does', 'have', 'with', 'from', 'that', 'this',
  'there', 'about', 'into', 'your', 'their', 'them', 'they', 'work', 'works', 'working',
  'landing', 'landings', 'mission', 'missions', 'space', 'tell', 'explain', 'mean', 'means',
]);

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE = 120;
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size >= MAX_CACHE) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { at: Date.now(), value });
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        // Wikimedia asks for a descriptive agent.
        'User-Agent': 'SpaceRelics3D/2.0 (educational Solar System explorer)',
      },
    });
    if (!res.ok) throw new Error(`wikipedia ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const enabled = () => process.env.WEB_KNOWLEDGE !== 'false';

/** Strips HTML that the search endpoint leaves in snippets. */
const clean = (text) =>
  String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Searches Wikipedia and returns the two best summaries.
 * @returns {Promise<{used: boolean, extracts: Array<{title:string, extract:string, url:string}>, query: string}>}
 */
async function lookup(query, { limit = 2, timeoutMs = 6000 } = {}) {
  const q = String(query || '').trim();
  if (!enabled() || q.length < 3) return { used: false, extracts: [], query: q };

  const key = `${limit}:${q.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const queryTokens = q
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3 && !STOPWORDS.has(t));

  try {
    const searchUrl =
      'https://en.wikipedia.org/w/api.php?format=json&origin=*&action=query&list=search&srlimit=6' +
      `&srsearch=${encodeURIComponent(q)}`;
    const search = await fetchJson(searchUrl, timeoutMs);
    const hits = (search && search.query && search.query.search) || [];

    // Wikipedia's ranking is keyword-based, so we fetch several summaries and keep the
    // ones that actually cover the question — otherwise "sky crane landing" can return
    // a poet called Stephen Crane.
    const candidates = await Promise.all(
      hits.slice(0, 5).map(async (hit) => {
        try {
          const summary = await fetchJson(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
            timeoutMs
          );
          const text = clean(summary.extract);
          if (!text || text.length < 60) return null;
          const haystack = `${hit.title} ${text}`.toLowerCase();
          const hits2 = queryTokens.filter((t) => haystack.includes(t)).length;
          const coverage = queryTokens.length ? hits2 / queryTokens.length : 1;
          return {
            title: hit.title,
            extract: text.length > 900 ? `${text.slice(0, 900)}…` : text,
            url:
              (summary.content_urls && summary.content_urls.desktop && summary.content_urls.desktop.page) ||
              `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
            // relevance: how much of the question the article actually covers
            relevance: coverage * 100 + hits2 * 10 + Math.min(30, text.length / 60),
          };
        } catch (err) {
          return null;
        }
      })
    );

    const ranked = candidates
      .filter(Boolean)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
      .map(({ relevance, ...rest }) => rest);

    const value = { used: ranked.length > 0, extracts: ranked, query: q };
    cacheSet(key, value);
    return value;
  } catch (err) {
    const value = { used: false, extracts: [], query: q, error: err.message };
    cacheSet(key, value);
    return value;
  }
}

/** Turns the question into a focused search phrase. */
function searchPhrase(message) {
  return String(message || '')
    .replace(/^(hey|hi|hello|please|so|ok|okay)[,\s]+/i, '')
    .replace(/[?]+$/g, '')
    .replace(/\b(tell me|can you|could you|whats|what's|please explain|explain|how does|how do|what is|what are)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

module.exports = { lookup, searchPhrase, enabled };
