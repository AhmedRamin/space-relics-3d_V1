const fs = require('fs');
const path = require('path');

/**
 * The database.
 *
 * The whole catalogue is one JSON file, loaded once into memory. There is no driver,
 * no connection string and no credentials — replacing the file and restarting the
 * process is the entire migration story.
 */

/**
 * Where the files live.
 *
 * The database ships INSIDE the server folder (`server/data/`), so a host that only
 * uploads/deploys the `server/` directory — which is exactly what a Render web service
 * with Root Directory = `server` does — still finds it. Resolution additionally falls
 * back to the repository root and the current working directory, so every common
 * deployment layout works without setting an environment variable.
 */
const SERVER_ROOT = path.resolve(__dirname, '..', '..'); // …/server
const REPO_ROOT = path.resolve(SERVER_ROOT, '..');

/** First existing candidate wins; otherwise the last candidate is returned (for the error). */
function resolveDataFile(fileName, configured) {
  const candidates = [];
  if (configured) {
    candidates.push(path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured));
  }
  candidates.push(
    path.join(SERVER_ROOT, 'data', fileName), // bundled with the server (preferred)
    path.join(process.cwd(), 'data', fileName),
    path.join(process.cwd(), 'server', 'data', fileName),
    path.join(REPO_ROOT, 'data', fileName) // legacy/root layout
  );
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[candidates.length - 1];
}

const DEFAULT_PATH = path.join(SERVER_ROOT, 'data', 'solar-system-dataset.json');
const DEFAULT_COORDS = path.join(SERVER_ROOT, 'data', 'coordinates.json');
const DEFAULT_MEDIA = path.join(SERVER_ROOT, 'data', 'media.json');

let dataset = null;
let maps = null;
let coordinates = { sites: {}, orbits: {} };
let media = { images: {} };

function datasetPath() {
  return resolveDataFile('solar-system-dataset.json', process.env.DATASET_PATH);
}

function coordinatesPath() {
  return resolveDataFile('coordinates.json', process.env.COORDINATES_PATH);
}

function mediaPath() {
  return resolveDataFile('media.json', process.env.MEDIA_PATH);
}

/**
 * Photographs resolved from Wikipedia for the records the workbook does not illustrate.
 * The workbook image always wins; this fills the gaps so every object can show a picture
 * of itself rather than its destination's photo.
 */
function loadMedia() {
  const file = mediaPath();
  if (!fs.existsSync(file)) {
    media = { images: {} };
    return media;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    media = { images: parsed.images || {}, meta: parsed.meta || {} };
    // eslint-disable-next-line no-console
    console.log(`[data] media.json → ${Object.keys(media.images).length} resolved photographs`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[data] media.json could not be read (${err.message})`);
    media = { images: {} };
  }
  return media;
}

/**
 * Photograph for a record.
 *
 * Priority: a resolved index entry marked `override` (used when the workbook picked the wrong
 * subject — its Rosalind Franklin image is a portrait of the chemist, not the rover) → the
 * workbook's own image → the resolved index entry → nothing.
 */
function imageFor(id, own) {
  const entry = media.images[id];
  if (entry && entry.override && entry.imageUrl) {
    return { imageUrl: entry.imageUrl, imageCredit: `Wikipedia · ${entry.title || ''}`.trim(), imageNote: entry.note || null };
  }
  if (own) return { imageUrl: own, imageCredit: 'Wikimedia Commons' };
  if (entry && entry.imageUrl) {
    return { imageUrl: entry.imageUrl, imageCredit: `Wikipedia · ${entry.title || entry.name || ''}`.trim() };
  }
  return { imageUrl: null, imageCredit: null };
}

/**
 * Curated positions, merged over the dataset.
 *
 * The mission workbook has no coordinates, so measured landing sites and orbital
 * elements live in their own editable file. Every entry carries a precision level and
 * a source, which the UI shows next to the position.
 */
function loadCoordinates() {
  const file = coordinatesPath();
  if (!fs.existsSync(file)) {
    coordinates = { sites: {}, orbits: {} };
    return coordinates;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    coordinates = { sites: parsed.sites || {}, orbits: parsed.orbits || {}, meta: parsed.meta || {} };
    // eslint-disable-next-line no-console
    console.log(
      `[data] coordinates.json → ${Object.keys(coordinates.sites).length} landing sites · ` +
        `${Object.keys(coordinates.orbits).length} orbital element sets`
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[data] coordinates.json could not be read (${err.message}) — positions fall back to shells`);
    coordinates = { sites: {}, orbits: {} };
  }
  return coordinates;
}

/** Position fields attached to any hardware record. */
function positionFor(id) {
  const site = coordinates.sites[id];
  const orbit = coordinates.orbits[id];
  if (site) {
    return {
      location: {
        lat: site.lat,
        lng: site.lng,
        label: site.label || null,
        region: site.region || null,
      },
      orbit: orbit || null,
      positionPrecision: site.precision || 'measured',
      coordinateSource: site.source || null,
    };
  }
  if (orbit) {
    return { location: null, orbit, positionPrecision: orbit.precision || 'shell', coordinateSource: orbit.source || null };
  }
  return { location: null, orbit: null, positionPrecision: null, coordinateSource: null };
}

function load() {
  const file = datasetPath();

  if (!fs.existsSync(file)) {
    throw new Error(
      `Dataset not found. Looked in:\n` +
        `  - ${path.join(SERVER_ROOT, 'data', 'solar-system-dataset.json')}\n` +
        `  - ${path.join(process.cwd(), 'data', 'solar-system-dataset.json')}\n` +
        `  - ${path.join(REPO_ROOT, 'data', 'solar-system-dataset.json')}\n` +
        `Put solar-system-dataset.json in server/data/ or set DATASET_PATH.`
    );
  }

  const raw = fs.readFileSync(file, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Dataset at ${file} is not valid JSON: ${err.message}`);
  }

  dataset = {
    meta: parsed.meta || {},
    bodies: parsed.bodies || [],
    moons: parsed.moons || [],
    missions: parsed.missions || [],
    stations: parsed.stations || [],
    rockets: parsed.rockets || [],
    index: parsed.index || {},
  };

  loadCoordinates();
  loadMedia();

  const byId = (list) => new Map(list.map((item) => [item.id, item]));
  maps = {
    bodies: byId(dataset.bodies),
    missions: byId(dataset.missions),
    stations: byId(dataset.stations),
    rockets: byId(dataset.rockets),
    moons: byId(dataset.moons),
    missionsByBody: new Map(),
    moonsByParent: new Map(),
  };

  dataset.missions.forEach((mission) => {
    const list = maps.missionsByBody.get(mission.bodyId) || [];
    list.push(mission);
    maps.missionsByBody.set(mission.bodyId, list);
  });
  dataset.moons.forEach((moon) => {
    const list = maps.moonsByParent.get(moon.parentId) || [];
    list.push(moon);
    maps.moonsByParent.set(moon.parentId, list);
  });

  // eslint-disable-next-line no-console
  console.log(
    `[data] ${path.basename(file)} → ${dataset.bodies.length} bodies · ${dataset.moons.length} moons · ` +
      `${dataset.missions.length} missions · ${dataset.stations.length} stations · ${dataset.rockets.length} rockets`
  );

  return dataset;
}

function ensure() {
  if (!dataset) load();
  return { dataset, maps };
}

const get = () => ensure().dataset;
const getMaps = () => ensure().maps;
const getFile = () => datasetPath();

function statusOf(record) {
  return record.statusGroup || 'ended';
}

function isWorking(record) {
  return record.workingNow === true;
}

/** Ordered so the 3D scene draws the most grounded hardware first. */
const KIND_ORDER = ['rover', 'helicopter', 'lander', 'station', 'orbiter', 'satellite', 'telescope', 'probe', 'impactor'];

function kindRank(kind) {
  const i = KIND_ORDER.indexOf(kind);
  return i === -1 ? KIND_ORDER.length : i;
}

function listBodies({ includeDwarf = true } = {}) {
  const { dataset: data, maps: m } = ensure();
  return data.bodies
    .filter((body) => includeDwarf || !body.isDwarf)
    .map((body) => ({
      ...body,
      ...imageFor(body.id, body.imageUrl),
      hardware: m.missionsByBody.get(body.id)?.length || 0,
      stations: body.id === 'earth' ? data.stations.length : 0,
      moonCount: (m.moonsByParent.get(body.id) || []).length,
      counts: (data.index[body.id] || {}).counts || {},
      total: (data.index[body.id] || {}).total || 0,
    }))
    .sort((a, b) => (a.meanDistanceAu || 0) - (b.meanDistanceAu || 0));
}

function getBody(id) {
  const { maps: m } = ensure();
  return m.bodies.get(id) || null;
}

/** Everything drawn around one body, in a stable order. */
function bodyHardware(id) {
  const { dataset: data, maps: m } = ensure();
  const body = m.bodies.get(id);
  if (!body) return null;

  const missions = (m.missionsByBody.get(id) || [])
    .slice()
    .sort((a, b) => kindRank(a.visualKind) - kindRank(b.visualKind) || (a.launchDate || '').localeCompare(b.launchDate || ''))
    .map((mission) => ({
      id: mission.id,
      kind: 'mission',
      visualKind: mission.visualKind,
      name: mission.name,
      agency: mission.agency,
      type: mission.type,
      target: mission.target,
      status: mission.status,
      statusGroup: statusOf(mission),
      workingNow: isWorking(mission),
      launchDate: mission.launchDate,
      launchVehicle: mission.launchVehicle,
      currentLocation: mission.currentLocation,
      achievement: mission.achievement,
      story: mission.story,
      ...imageFor(mission.id, mission.imageUrl),
      referenceUrl: mission.referenceUrl,
      bodyId: mission.bodyId,
      ...positionFor(mission.id),
    }));

  const stations = (id === 'earth' ? data.stations : [])
    .slice()
    .map((station) => ({
      id: station.id,
      kind: 'station',
      visualKind: 'station',
      name: station.name,
      operator: station.operator,
      type: station.type,
      orbit: station.orbit,
      status: station.status,
      statusGroup: statusOf(station),
      workingNow: isWorking(station),
      launchDate: station.firstModuleLaunch,
      launchVehicle: station.launchVehicle,
      currentLocation: station.orbit ? `${station.orbit}${isWorking(station) ? ' — operational' : ''}` : null,
      achievement: station.achievement,
      story: station.story,
      ...imageFor(station.id, station.imageUrl),
      referenceUrl: station.referenceUrl,
      bodyId: 'earth',
      ...positionFor(station.id),
    }))
    .sort((a, b) => Number(b.workingNow) - Number(a.workingNow) || (a.launchDate || '').localeCompare(b.launchDate || ''));

  const histogram = {};
  [...missions, ...stations].forEach((item) => {
    histogram[item.visualKind] = (histogram[item.visualKind] || 0) + 1;
  });

  return {
    body,
    hardware: [...missions, ...stations],
    missions,
    stations,
    histogram,
    workingNow: [...missions, ...stations].filter(isWorking).length,
  };
}

function filterMissions(filters = {}) {
  const { dataset: data } = ensure();
  const q = (filters.q || '').toLowerCase().trim();

  return data.missions.filter((mission) => {
    if (filters.body && mission.bodyId !== filters.body) return false;
    if (filters.category && (mission.category || '').toUpperCase() !== filters.category.toUpperCase()) return false;
    if (filters.kind && mission.visualKind !== filters.kind) return false;
    if (filters.status && mission.statusGroup !== filters.status) return false;
    if (filters.agency && !(mission.agency || '').toLowerCase().includes(filters.agency.toLowerCase())) return false;
    if (filters.working === 'true' && !isWorking(mission)) return false;
    if (filters.working === 'false' && isWorking(mission)) return false;
    if (q) {
      const haystack = [mission.name, mission.agency, mission.type, mission.target, mission.category, mission.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function facets() {
  const { dataset: data } = ensure();
  const count = (list, key) =>
    list.reduce((acc, item) => {
      const value = item[key];
      if (!value) return acc;
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});

  return {
    bodies: data.bodies
      .map((b) => ({ value: b.id, label: b.name, count: (data.index[b.id] || {}).total || 0 }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count),
    kinds: Object.entries(count(data.missions, 'visualKind'))
      .map(([value, n]) => ({ value, count: n }))
      .sort((a, b) => b.count - a.count),
    categories: Object.entries(count(data.missions, 'category'))
      .map(([value, n]) => ({ value, count: n }))
      .sort((a, b) => b.count - a.count),
    statusGroups: Object.entries(count(data.missions, 'statusGroup'))
      .map(([value, n]) => ({ value, count: n }))
      .sort((a, b) => b.count - a.count),
    stationOperators: Object.entries(count(data.stations, 'operator'))
      .map(([value, n]) => ({ value, count: n }))
      .sort((a, b) => b.count - a.count),
    counts: data.meta.counts || {},
  };
}

/**
 * Words that carry no identifying information. Without this list a question like
 * "compare Curiosity and Perseverance" matches the moon "Pandia" because it contains
 * the substring "and".
 */
const STOPWORDS = new Set([
  'and', 'the', 'for', 'are', 'was', 'were', 'its', 'it', 'this', 'that', 'with', 'from',
  'how', 'many', 'much', 'did', 'does', 'what', 'which', 'who', 'when', 'where', 'why',
  'tell', 'about', 'still', 'working', 'work', 'works', 'now', 'mission', 'missions',
  'station', 'stations', 'rocket', 'rockets', 'launch', 'launched', 'vehicle', 'vehicles',
  'moon', 'moons', 'body', 'bodies', 'planet', 'planets', 'compare', 'versus', 'more',
  'achieved', 'achieve', 'achievement', 'stop', 'stopped', 'ended', 'end', 'between',
]);

function escapeRe(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when `needle` appears in `haystack` as a whole word (or phrase). */
function bounded(haystack, needle) {
  if (!needle || needle.length < 2) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRe(needle)}([^a-z0-9]|$)`).test(haystack);
}

/**
 * Very small fuzzy matcher: exact > whole word/phrase > token overlap.
 *
 * Matching is word-bounded rather than substring-based, because substring matching makes
 * "ion" resolve to the moon Dione and "sky" resolve to Skylab.
 */
function scoreName(name, query) {
  const n = String(name || '').toLowerCase();
  const q = String(query || '').toLowerCase();
  if (!n || !q || q.length < 2) return 0;
  if (n === q) return 1000;

  // Numbers are meaningful: "Voyager 2" must not resolve to "Voyager 1".
  const digits = (q.match(/\d+/g) || []).join('');
  if (digits && !digits.split('').every((d) => n.includes(d))) return 0;

  if (bounded(n, q)) return 500 - n.length;

  const tokens = q.split(/\s+/).filter((t) => t.length > 2 && !STOPWORDS.has(t));
  if (!tokens.length) return 0;

  const hits = tokens.filter((t) => bounded(n, t)).length;
  if (!hits) return 0;
  // All tokens present is a much stronger signal than a partial overlap.
  return hits === tokens.length ? 200 + hits * 10 : 20 * hits;
}

function findEntity(phrase) {
  const { dataset: data } = ensure();
  if (!phrase) return null;

  const candidates = [];
  const push = (kind, list) => {
    list.forEach((item) => {
      const score = scoreName(item.name, phrase);
      if (score > 0) candidates.push({ kind, id: item.id, name: item.name, record: item, score });
    });
  };

  push('mission', data.missions);
  push('station', data.stations);
  push('rocket', data.rockets);
  push('body', data.bodies);
  push('moon', data.moons);

  candidates.sort(
    (a, b) => b.score - a.score || b.name.length - a.name.length || a.name.localeCompare(b.name)
  );
  return candidates[0] || null;
}

function search(query, limit = 24) {
  const { dataset: data } = ensure();
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const results = [];
  const collect = (kind, list, extra) => {
    list.forEach((item) => {
      const score = scoreName(item.name, q);
      if (score > 0) results.push({ kind, id: item.id, name: item.name, score, ...extra(item) });
    });
  };

  collect('body', data.bodies, (b) => ({ subtitle: b.type, bodyId: b.id }));
  collect('mission', data.missions, (m) => ({
    subtitle: `${m.type} · ${m.target}`,
    bodyId: m.bodyId,
    status: m.statusGroup,
    workingNow: m.workingNow,
  }));
  collect('station', data.stations, (s) => ({ subtitle: `${s.operator} · ${s.orbit || 'orbit'}`, status: s.statusGroup, workingNow: s.workingNow }));
  collect('rocket', data.rockets, (r) => ({ subtitle: `${r.country} · ${r.manufacturer || ''}`.trim(), status: r.statusGroup }));
  collect('moon', data.moons, (m) => ({ subtitle: `Moon of ${m.parentName}`, bodyId: m.parentId }));

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

function countsFor(kind) {
  const { dataset: data } = ensure();
  const map = {
    missions: data.missions.length,
    stations: data.stations.length,
    rockets: data.rockets.length,
    moons: data.moons.length,
    bodies: data.bodies.length,
    planets: data.bodies.filter((b) => b.isPlanet).length,
    dwarfs: data.bodies.filter((b) => b.isDwarf).length,
    activeMissions: data.missions.filter(isWorking).length,
  };
  return kind ? map[kind] : map;
}

module.exports = {
  load,
  positionFor,
  coordinates: () => coordinates,
  media: () => media,
  mediaPath,
  coordinatesPath,
  get,
  getMaps,
  getFile,
  listBodies,
  getBody,
  bodyHardware,
  filterMissions,
  facets,
  findEntity,
  search,
  countsFor,
  isWorking,
  statusOf,
  KIND_ORDER,
};
