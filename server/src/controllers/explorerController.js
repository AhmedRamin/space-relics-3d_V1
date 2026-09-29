const store = require('../data/store');
const { ApiError } = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/** Photograph for a record, from the workbook or the resolved media index. */
function mediaFor(record) {
  const media = store.media ? store.media() : { images: {} };
  const entry = media.images ? media.images[record.id] : null;
  if (entry && entry.override && entry.imageUrl) {
    return { imageUrl: entry.imageUrl, imageCredit: `Wikipedia · ${entry.title || ''}`.trim(), imageNote: entry.note || null };
  }
  if (record.imageUrl) return { imageUrl: record.imageUrl, imageCredit: 'Wikimedia Commons' };
  return entry && entry.imageUrl
    ? { imageUrl: entry.imageUrl, imageCredit: `Wikipedia · ${entry.title || entry.name || ''}`.trim() }
    : { imageUrl: null, imageCredit: null };
}

function paginate(list, query, defaultLimit = 24) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  const start = (page - 1) * limit;
  return { page, limit, total: list.length, pages: Math.max(1, Math.ceil(list.length / limit)), slice: list.slice(start, start + limit) };
}

/** GET /api/catalog — one call that boots the whole 3D scene. */
const catalog = asyncHandler(async (req, res) => {
  const data = store.get();
  res.json({
    ok: true,
    data: {
      meta: data.meta,
      bodies: store.listBodies().map((body) => ({
        id: body.id,
        name: body.name,
        type: body.type,
        isPlanet: body.isPlanet,
        isDwarf: body.isDwarf,
        meanDistanceAu: body.meanDistanceAu,
        diameterKm: body.diameterKm,
        ringSystem: body.ringSystem,
        // Needed by the details panel: a mission or station with no photograph of its own
        // falls back to its destination's image.
        imageUrl: body.imageUrl || null,
        parentId: body.parentId || null,
        color: body.color || null,
        hardware: body.hardware,
        stations: body.stations,
        moonCount: body.moonCount,
        counts: body.counts,
        total: body.total,
      })),
      index: data.index,
      counts: data.meta.counts,
      facets: store.facets(),
      coordinateMeta: store.coordinates().meta || null,
    },
  });
});

/** GET /api/bodies */
const bodies = asyncHandler(async (req, res) => {
  res.json({ ok: true, data: store.listBodies({ includeDwarf: req.query.dwarf !== 'false' }) });
});

/** GET /api/bodies/:id */
const bodyDetail = asyncHandler(async (req, res) => {
  const id = String(req.params.id).toLowerCase();
  const detailed = store.bodyHardware(id);
  if (!detailed) throw ApiError.notFound(`No body with id "${id}"`);

  const moons = store.getMaps().moonsByParent.get(id) || [];
  res.json({
    ok: true,
    data: {
      ...detailed,
      moonCount: moons.length,
      moons: moons
        .slice()
        .sort((a, b) => (b.meanRadiusKm || 0) - (a.meanRadiusKm || 0))
        .slice(0, 24),
    },
  });
});

/** GET /api/bodies/:id/hardware — the exact list the 3D scene renders. */
const bodyHardware = asyncHandler(async (req, res) => {
  const id = String(req.params.id).toLowerCase();
  const detailed = store.bodyHardware(id);
  if (!detailed) throw ApiError.notFound(`No body with id "${id}"`);
  const filtered = req.query.working === 'true' ? detailed.hardware.filter((h) => h.workingNow) : detailed.hardware;
  res.json({
    ok: true,
    body: detailed.body,
    histogram: detailed.histogram,
    workingNow: detailed.workingNow,
    count: filtered.length,
    data: filtered,
  });
});

/** GET /api/missions */
const missions = asyncHandler(async (req, res) => {
  const filtered = store.filterMissions(req.query);
  const page = paginate(filtered, req.query);
  res.json({
    ok: true,
    count: page.slice.length,
    total: page.total,
    page: page.page,
    pages: page.pages,
    data: page.slice,
  });
});

/** GET /api/missions/:id */
const mission = asyncHandler(async (req, res) => {
  const id = String(req.params.id).toLowerCase();
  const record = store.getMaps().missions.get(id);
  if (!record) throw ApiError.notFound(`No mission with id "${id}"`);
  const body = store.getBody(record.bodyId);
  res.json({
    ok: true,
    data: {
      mission: { ...record, ...store.positionFor(record.id), ...mediaFor(record) },
      body: body || null,
    },
  });
});

/** GET /api/stations */
const stations = asyncHandler(async (req, res) => {
  let list = store.get().stations.slice();
  if (req.query.operator) list = list.filter((s) => (s.operator || '').toLowerCase().includes(String(req.query.operator).toLowerCase()));
  if (req.query.status) list = list.filter((s) => s.statusGroup === req.query.status);
  if (req.query.working === 'true') list = list.filter((s) => s.workingNow);
  const page = paginate(list, req.query, 40);
  res.json({ ok: true, count: page.slice.length, total: page.total, page: page.page, pages: page.pages, data: page.slice });
});

/** GET /api/stations/:id */
const station = asyncHandler(async (req, res) => {
  const record = store.getMaps().stations.get(String(req.params.id).toLowerCase());
  if (!record) throw ApiError.notFound(`No station with id "${req.params.id}"`);
  res.json({ ok: true, data: record });
});

/** GET /api/rockets */
const rockets = asyncHandler(async (req, res) => {
  let list = store.get().rockets.slice();
  if (req.query.country) list = list.filter((r) => (r.country || '').toLowerCase().includes(String(req.query.country).toLowerCase()));
  if (req.query.status) list = list.filter((r) => r.statusGroup === req.query.status);
  if (req.query.flying === 'true') list = list.filter((r) => r.flyingToday);
  list.sort((a, b) => (b.heightM || 0) - (a.heightM || 0));
  const page = paginate(list, req.query, 40);
  res.json({ ok: true, count: page.slice.length, total: page.total, page: page.page, pages: page.pages, data: page.slice });
});

/** GET /api/rockets/:id */
const rocket = asyncHandler(async (req, res) => {
  const record = store.getMaps().rockets.get(String(req.params.id).toLowerCase());
  if (!record) throw ApiError.notFound(`No launch vehicle with id "${req.params.id}"`);
  res.json({ ok: true, data: record });
});

/** GET /api/moons */
const moons = asyncHandler(async (req, res) => {
  let list = store.get().moons.slice();
  if (req.query.parent) list = list.filter((m) => m.parentId === String(req.query.parent).toLowerCase());
  if (req.query.q) {
    const q = String(req.query.q).toLowerCase();
    list = list.filter((m) => (m.name || '').toLowerCase().includes(q) || (m.parentName || '').toLowerCase().includes(q));
  }
  list.sort((a, b) => (b.meanRadiusKm || 0) - (a.meanRadiusKm || 0));
  const page = paginate(list, req.query, 40);
  res.json({ ok: true, count: page.slice.length, total: page.total, page: page.page, pages: page.pages, data: page.slice });
});

/** GET /api/moons/:id */
const moon = asyncHandler(async (req, res) => {
  const record = store.getMaps().moons.get(String(req.params.id).toLowerCase());
  if (!record) throw ApiError.notFound(`No moon with id "${req.params.id}"`);
  res.json({ ok: true, data: record });
});

/** GET /api/search */
const search = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) throw ApiError.badRequest('Provide at least two characters with ?q=');
  const data = store.search(q, Math.min(50, Number.parseInt(req.query.limit, 10) || 24));
  res.json({ ok: true, query: q, count: data.length, data });
});

/** GET /api/facets */
const facets = asyncHandler(async (req, res) => {
  res.json({ ok: true, data: store.facets() });
});

/** GET /api/health */
const health = asyncHandler(async (req, res) => {
  const data = store.get();
  res.json({
    ok: true,
    service: 'space-relics-3d-api',
    storage: 'json-file',
    datasetPath: store.getFile(),
    coordinatesPath: store.coordinatesPath(),
    counts: data.meta.counts,
    media: {
      resolved: Object.keys((store.media ? store.media().images : {}) || {}).length,
    },
    positions: {
      landingSites: Object.keys(store.coordinates().sites || {}).length,
      orbitalElements: Object.keys(store.coordinates().orbits || {}).length,
    },
    aiProviderConfigured: Boolean(process.env.AI_API_KEY),
    time: new Date().toISOString(),
  });
});

module.exports = {
  catalog,
  bodies,
  bodyDetail,
  bodyHardware,
  missions,
  mission,
  stations,
  station,
  rockets,
  rocket,
  moons,
  moon,
  search,
  facets,
  health,
};
