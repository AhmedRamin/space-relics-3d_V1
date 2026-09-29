/**
 * Visual scaling.
 *
 * Real distances are unusable in one frame (Mercury is 0.39 AU, Sedna 506 AU), so they are
 * compressed — but the compression has to leave room for the bodies themselves. The scale is
 * piecewise:
 *
 *   inner zone (≤ 1.6 AU)   linear, generous spacing so Mercury → Venus → Earth → Mars never
 *                           touch each other or the Sun
 *   outer zone (> 1.6 AU)   logarithmic, so Neptune and the Kuiper belt still fit on screen
 *   layoutOrbits()          enforces a minimum gap between neighbours whatever the dataset says
 *
 * `sunRadius()` caps the Sun regardless of bodyRadius(), and `minOrbitRadius()` guarantees
 * every orbit clears the Sun plus its own radius plus a margin.
 */

const INNER_LIMIT_AU = 1.6;
const INNER_BASE = 20;
const INNER_SLOPE = 21; // wider: bodies got bigger, so the inner zone needs the room
const OUTER_K = 25.3;
const MAX_ORBIT = 232;
const SUN_RADIUS = 4.4;
const SUN_MARGIN = 3.4;
const MIN_GAP = 1.2;

export function orbitRadius(au) {
  const value = Math.max(0.05, Number(au) || 1);
  if (value <= INNER_LIMIT_AU) return INNER_BASE + INNER_SLOPE * value;
  const base = INNER_BASE + INNER_SLOPE * INNER_LIMIT_AU;
  return Math.min(MAX_ORBIT, base + OUTER_K * Math.log(value / INNER_LIMIT_AU));
}

/** Diameter in km → sphere radius. Sized up from the previous pass so worlds read as worlds. */
export function bodyRadius(diameterKm, isDwarf) {
  const d = Number(diameterKm) || 3000;
  const scaled = 0.42 + Math.pow(d / 12742, 0.44) * 1.5;
  return isDwarf ? Math.max(0.34, scaled * 0.58) : scaled;
}

export function sunRadius() {
  return SUN_RADIUS;
}

export function minOrbitRadius(planetRadius) {
  return SUN_RADIUS + (Number(planetRadius) || 0) + SUN_MARGIN;
}

export function layoutOrbits(bodies = []) {
  const entries = bodies
    .filter((body) => body && body.id !== 'moon' && body.parentId !== 'earth')
    .map((body) => {
      const radius = body.id === 'sun' ? sunRadius() : bodyRadius(body.diameterKm, body.isDwarf);
      const au = Number(body.meanDistanceAu) || 0;
      return {
        id: body.id,
        au,
        radius,
        distance: au <= 0 ? 0 : Math.max(orbitRadius(au), minOrbitRadius(radius)),
      };
    })
    .sort((a, b) => a.distance - b.distance || (a.au || 0) - (b.au || 0));

  const out = new Map();
  let previous = null;
  entries.forEach((entry) => {
    if (!previous || entry.distance === 0) {
      out.set(entry.id, entry.distance);
      previous = entry.distance === 0 ? null : entry;
      return;
    }
    entry.distance = Math.max(entry.distance, previous.distance + previous.radius + entry.radius + MIN_GAP);
    out.set(entry.id, entry.distance);
    previous = entry;
  });
  return out;
}

export function hash01(text) {
  let h = 2166136261;
  const s = String(text || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function surfaceSlot(index, total, radius) {
  const i = index + 0.5;
  const y = 1 - (i / Math.max(1, total)) * 0.9;
  const r = Math.sqrt(Math.max(0.05, 1 - y * y));
  const theta = i * GOLDEN_ANGLE;
  return [radius * r * Math.cos(theta), radius * y, radius * r * Math.sin(theta)];
}

export function orbitSlot(index, total, bodyRadiusUnits) {
  const shell = Math.floor(index / Math.max(1, Math.ceil(total / 3)));
  const inShell = index % Math.max(1, Math.ceil(total / 3));
  const perShell = Math.max(1, Math.ceil(total / 3));
  const radius = bodyRadiusUnits * (1.9 + shell * 0.55);
  const angle = (inShell / perShell) * Math.PI * 2 + shell * 0.7;
  const tilt = (hash01(`tilt-${index}`) - 0.5) * 0.7;
  return {
    radius,
    angle,
    tilt,
    position: [Math.cos(angle) * radius, Math.sin(tilt) * radius * 0.35, Math.sin(angle) * radius],
  };
}

export function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function formatAu(value) {
  if (value === null || value === undefined) return '—';
  return `${formatNumber(value, 3)} AU`;
}
