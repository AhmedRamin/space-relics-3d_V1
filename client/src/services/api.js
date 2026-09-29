import { API_BASE } from '../lib/constants';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    const error = new Error(`Cannot reach the API at ${API_BASE}. Start it with "npm run dev" in server/.`);
    error.status = 0;
    throw error;
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (err) {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = new Error((payload && payload.error && payload.error.message) || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const api = {
  catalog: (opts) => request('/catalog', opts),
  bodies: (opts) => request('/bodies', opts),
  body: (id, opts) => request(`/bodies/${encodeURIComponent(id)}`, opts),
  hardware: (id, opts) => request(`/bodies/${encodeURIComponent(id)}/hardware`, opts),
  missions: (params = {}, opts = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)).toString();
    return request(`/missions${qs ? `?${qs}` : ''}`, opts);
  },
  stations: (opts) => request('/stations', opts),
  rockets: (opts) => request('/rockets', opts),
  search: (q, opts) => request(`/search?q=${encodeURIComponent(q)}`, opts),
  chat: (body, opts) => request('/chat', { method: 'POST', body, ...opts }),
  engines: (opts) => request('/chat/engines', opts),
};
