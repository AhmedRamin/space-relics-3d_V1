/**
 * Where the API lives.
 *
 * In production the Express server serves this bundle and the API on the same origin,
 * so `/api` is correct and needs no configuration. In development Vite runs on :5173
 * while the API runs on :4000, so we point at it directly (override with VITE_API_URL
 * if you split the two across hosts).
 */
export const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_URL) ||
  (import.meta.env && import.meta.env.PROD ? '/api' : 'http://localhost:4000/api');

/** The 3D contract: these are the visualKind values in the dataset. */
export const KINDS = {
  rover: { label: 'Rover', icon: '🤖', color: '#c8863c' },
  helicopter: { label: 'Helicopter', icon: '🚁', color: '#c9b25f' },
  lander: { label: 'Lander', icon: '🛬', color: '#8fb8c9' },
  station: { label: 'Space station', icon: '🛰️', color: '#9cb4cf' },
  orbiter: { label: 'Orbiter', icon: '🚀', color: '#9a8fd0' },
  satellite: { label: 'Satellite', icon: '📡', color: '#87b7a2' },
  telescope: { label: 'Space telescope', icon: '🔭', color: '#c99bb4' },
  probe: { label: 'Probe / flyby', icon: '☄️', color: '#b9c2d0' },
  impactor: { label: 'Impactor', icon: '💥', color: '#c98a8a' },
};

export const KIND_ORDER = ['rover', 'helicopter', 'lander', 'station', 'orbiter', 'satellite', 'telescope', 'probe', 'impactor'];

export const STATUSES = {
  active: { label: 'Working now', symbol: '●' },
  ended: { label: 'Ended', symbol: '○' },
  partial: { label: 'Partial success', symbol: '◐' },
  failed: { label: 'Failed', symbol: '✕' },
  lost: { label: 'Lost', symbol: '⚠' },
  planned: { label: 'Planned', symbol: '◌' },
};

export const PRECISION = {
  measured: { label: 'Measured position', symbol: '◎', description: 'Published coordinates, source shown below.' },
  reported: { label: 'Reported position', symbol: '◉', description: 'Coordinates from the mission report.' },
  approximate: { label: 'Approximate position', symbol: '◍', description: 'Best available estimate — treat as a region.' },
  planned: { label: 'Planned site', symbol: '◌', description: 'The landing site is chosen; the vehicle has not arrived yet.' },
  unlocated: { label: 'Position not published', symbol: '≈', description: 'Shown on a band, not at a surveyed point.' },
  shell: { label: 'Orbit altitude not published', symbol: '◌', description: 'Shown on a labelled shell.' },
};

/** Real orbital inclinations to the ecliptic (degrees). */
export const ORBITAL_INCLINATION = {
  mercury: 7.0,
  venus: 3.39,
  earth: 0,
  moon: 5.14,
  mars: 1.85,
  asteroids: 10,
  ceres: 10.6,
  jupiter: 1.3,
  saturn: 2.49,
  uranus: 0.77,
  neptune: 1.77,
  pluto: 17.16,
  haumea: 28.2,
  makemake: 29,
  gonggong: 30.7,
  quaoar: 8,
  eris: 44,
  sedna: 11.9,
  sun: 0,
};

export const BODY_COLORS = {
  sun: '#ffcb6b',
  mercury: '#8d8880',
  venus: '#e0c48a',
  earth: '#2f6fbe',
  moon: '#a8a49c',
  mars: '#b25a30',
  asteroids: '#7d6f60',
  ceres: '#8e8880',
  jupiter: '#c9a97a',
  saturn: '#d8c69a',
  uranus: '#9ad4dd',
  neptune: '#5a7bd0',
  pluto: '#b7a696',
  haumea: '#8a94a8',
  quaoar: '#8a94a8',
  makemake: '#8a94a8',
  gonggong: '#8a94a8',
  eris: '#8a94a8',
  sedna: '#8a94a8',
};

/** Bodies with enough atmosphere to warrant a rim glow in the scene. */
export const ATMOSPHERES = {
  earth: { color: '#5aa7ff', intensity: 1.0, power: 2.4 },
  venus: { color: '#e8c07a', intensity: 1.15, power: 2.0 },
  mars: { color: '#c98a6a', intensity: 0.4, power: 3.2 },
  jupiter: { color: '#d8bb8c', intensity: 0.5, power: 2.8 },
  saturn: { color: '#e0d0a4', intensity: 0.45, power: 2.8 },
  uranus: { color: '#9ad4dd', intensity: 0.55, power: 2.6 },
  neptune: { color: '#5a7bd0', intensity: 0.6, power: 2.6 },
  moon: { color: '#8899aa', intensity: 0.12, power: 3.4 },
};

/** Ring systems: inner/outer multiplier of the body radius. */
export const RINGS = {
  saturn: { inner: 1.35, outer: 2.3, color: '#d9c9a3', opacity: 0.55, tiltExtra: 0 },
  uranus: { inner: 1.6, outer: 2.0, color: '#9ad4dd', opacity: 0.3, tiltExtra: 0 },
  neptune: { inner: 1.7, outer: 2.1, color: '#5a7bd0', opacity: 0.22, tiltExtra: 0 },
  jupiter: { inner: 1.5, outer: 1.75, color: '#c9a97a', opacity: 0.18, tiltExtra: 0 },
};

export const bodyColor = (id, fallback = '#9aa6bd') => BODY_COLORS[id] || fallback;
