const store = require('./../data/store');

/**
 * The chat guide.
 *
 * Answers are composed from the data file only, so the guide cannot invent a mission,
 * a date or a status. Optional LLM rewording happens in aiService; the facts always
 * come from here.
 */

const fmtNum = (n, digits = 0) =>
  n === null || n === undefined || Number.isNaN(n)
    ? '—'
    : Number(n).toLocaleString('en-US', { maximumFractionDigits: digits });

/** Human-readable position for a hardware record, from the curated coordinate file. */
function positionLine(record) {
  const pos = store.positionFor(record.id);
  if (!pos) return null;
  if (pos.location) {
    const lat = Math.abs(pos.location.lat).toFixed(4);
    const lng = Math.abs(pos.location.lng).toFixed(4);
    return `Position: ${lat} degrees ${pos.location.lat >= 0 ? 'N' : 'S'}, ${lng} degrees ${
      pos.location.lng >= 0 ? 'E' : 'W'
    }${pos.location.label ? ` (${pos.location.label})` : ''} — ${pos.positionPrecision}, ${pos.coordinateSource}.`;
  }
  if (pos.orbit && pos.orbit.altitudeKm !== null && pos.orbit.altitudeKm !== undefined) {
    return `Orbit: ${pos.orbit.label || `${pos.orbit.altitudeKm} km altitude`}${
      pos.orbit.inclinationDeg !== null && pos.orbit.inclinationDeg !== undefined ? `, ${pos.orbit.inclinationDeg} degrees inclination` : ''
    } — ${pos.positionPrecision}, ${pos.coordinateSource}.`;
  }
  return pos.orbit && pos.orbit.label ? `Track: ${pos.orbit.label}.` : null;
}

function statusLine(record) {
  const working = record.workingNow ? 'working now' : 'not working now';
  const status = record.status || record.statusGroup || 'unknown';
  return `${status} (${working})`;
}

function missionAnswer(mission, mode) {
  switch (mode) {
    case 'status':
      return `${mission.name} is recorded as ${statusLine(mission)}. ${
        mission.workingNowText ? `Workbook note: "${mission.workingNowText}".` : ''
      } Current location: ${mission.currentLocation || 'not recorded'}.`;
    case 'end':
      return `${mission.name} — status: ${statusLine(mission)}. ${
        mission.achievement ? `What it achieved before that: ${mission.achievement}` : ''
      } Its record's last known location is ${mission.currentLocation || 'not recorded'}.`;
    case 'achievement':
      return `${mission.name} (${mission.type}, ${mission.agency}) — ${mission.achievement || 'no achievement summary recorded.'}`;
    case 'launch':
      return `${mission.name} launched ${mission.launchDate || 'on an unknown date'} on a ${
        mission.launchVehicle || 'launch vehicle that is not recorded'
      }, targeting ${mission.target}. Type: ${mission.type}. Agency: ${mission.agency}.`;
    case 'where':
      return [
        `${mission.name} is now at: ${mission.currentLocation || 'not recorded'}.`,
        `It was launched ${mission.launchDate || '—'} toward ${mission.target}.`,
        positionLine(mission),
      ]
        .filter(Boolean)
        .join(' ');
    case 'story':
      return `${mission.name}: ${mission.story || mission.achievement || 'no story recorded.'}`;
    default:
      return [
        `${mission.name} — ${mission.type} · ${mission.agency} · ${statusLine(mission)}.`,
        `Target: ${mission.target}. Launched ${mission.launchDate || '—'}${
          mission.launchVehicle ? ` on a ${mission.launchVehicle}` : ''
        }.`,
        positionLine(mission),
        mission.achievement ? `Achievement: ${mission.achievement}` : '',
        mission.currentLocation ? `Now: ${mission.currentLocation}` : '',
      ]
        .filter(Boolean)
        .join(' ');
  }
}

function stationAnswer(station, mode) {
  if (mode === 'status') {
    return `${station.name} (${station.operator}) is ${statusLine(station)}. Orbit: ${station.orbit || 'not recorded'}. ${
      station.workingNowText ? `Workbook note: "${station.workingNowText}".` : ''
    }`;
  }
  if (mode === 'achievement') {
    return `${station.name} (${station.operator}, ${station.type}) — ${station.achievement || 'no achievement summary recorded.'}`;
  }
  if (mode === 'launch') {
    return `${station.name} launched its first module on ${station.firstModuleLaunch || 'an unknown date'}${
      station.launchVehicle ? ` on a ${station.launchVehicle}` : ''
    }. ${statusLine(station)}.`;
  }
  return [
    `${station.name} — ${station.type} · ${station.operator} · ${statusLine(station)}.`,
    `First module: ${station.firstModuleLaunch || '—'}. Orbit: ${station.orbit || '—'}.`,
    positionLine(station),
    station.story || '',
    station.achievement ? `Achievement: ${station.achievement}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function rocketAnswer(rocket, mode) {
  if (mode === 'payload') {
    return `${rocket.name}: ${fmtNum(rocket.payloadLeoKg)} kg to LEO${
      rocket.payloadGtoKg ? ` and ${fmtNum(rocket.payloadGtoKg)} kg to GTO` : ''
    }, ${rocket.heightM ? `${rocket.heightM} m tall` : 'height not recorded'}. Status: ${rocket.status} (${rocket.flyingTodayText || '—'}).`;
  }
  return [
    `${rocket.name} — ${rocket.country}${rocket.manufacturer ? ` · ${rocket.manufacturer}` : ''} · ${rocket.status}.`,
    `First flight: ${rocket.firstFlight || '—'}. Flying today: ${rocket.flyingTodayText || '—'}.`,
    rocket.story || '',
    rocket.notableMissions ? `Notable missions: ${rocket.notableMissions}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

const KIND_WORDS = {
  rover: ['rover', 'rovers'],
  helicopter: ['helicopter', 'rotorcraft'],
  lander: ['lander', 'landers'],
  station: ['station', 'stations'],
  orbiter: ['orbiter', 'orbiters'],
  satellite: ['satellite', 'satellites'],
  telescope: ['telescope', 'telescopes', 'observatory', 'observatories'],
  probe: ['probe', 'probes', 'flyby', 'flybys'],
  impactor: ['impactor', 'impactors'],
};

/**
 * "Why do Mars rovers stop working?" is a question about a subset of a body's hardware,
 * so answer with that subset and its real statuses instead of the planet overview.
 */
function subsetAnswer(body, message, intent) {
  const m = message.toLowerCase();
  const kinds = Object.entries(KIND_WORDS)
    .filter(([, words]) => words.some((w) => m.includes(w)))
    .map(([kind]) => kind);

  if (!kinds.length) return null;

  const detail = store.bodyHardware(body.id);
  if (!detail) return null;

  const matching = detail.hardware.filter((item) => kinds.includes(item.visualKind));
  if (!matching.length) return null;

  // "stopped working" contains both ideas, so the stopped phrasing wins unless the
  // visitor explicitly asked what is still operating.
  const stoppedPhrase = /(stop|stopped|stopping|no longer|ended|fail|failed|died|dead|not working)/.test(m);
  const stillPhrase = /(still working|still operating|working now|currently working|remains? active|alive|are working)/.test(m);

  let list = matching;
  let qualifier = '';
  if (stoppedPhrase && !stillPhrase) {
    list = matching.filter((item) => !item.workingNow);
    qualifier = 'no longer working';
  } else if (stillPhrase) {
    list = matching.filter((item) => item.workingNow);
    qualifier = 'still working now';
  }

  const label = kinds.length === 1 ? `${KINDS_WORD[kinds[0]]}` : `${kinds.join(' and ')}`;
  const shown = list.slice(0, 14).map((item) => `${item.name} (${item.status || item.statusGroup})`);

  const intro = qualifier
    ? `${list.length} of the ${matching.length} ${label} sent to ${body.name} are ${qualifier}`
    : `All ${matching.length} ${label} sent to ${body.name}`;

  const lines = [
    `${intro}: ${shown.join('; ')}${list.length > shown.length ? `, plus ${list.length - shown.length} more.` : '.'}`,
    intent === 'end'
      ? 'Each entry in the record shows the documented ending — the workbook status column carries the date the mission stopped.'
      : '',
    `${body.name} currently has ${detail.workingNow} working objects out of ${detail.hardware.length} in the scene.`,
  ].filter(Boolean);

  return {
    answer: lines.join(' '),
    refs: [
      { kind: 'body', id: body.id, name: body.name },
      ...list.slice(0, 4).map((item) => ({ kind: 'mission', id: item.id, name: item.name })),
    ],
    confidence: 900,
    primaryKind: 'body',
    intent,
  };
}

const KINDS_WORD = {
  rover: 'rovers',
  helicopter: 'helicopters',
  lander: 'landers',
  station: 'space stations',
  orbiter: 'orbiters',
  satellite: 'satellites',
  telescope: 'space telescopes',
  probe: 'probes and flyby craft',
  impactor: 'impactors',
};

function bodyAnswer(body) {
  const hardware = store.bodyHardware(body.id);
  const lines = [
    `${body.name} — ${body.type}.`,
    body.meanDistanceAu !== null && body.meanDistanceAu !== undefined
      ? `${fmtNum(body.meanDistanceAu, 3)} AU from the Sun${body.diameterKm ? `, ${fmtNum(body.diameterKm)} km across` : ''}.`
      : '',
    body.moonsConfirmed ? `Confirmed moons: ${body.moonsConfirmed}${body.notableMoons ? ` (${body.notableMoons})` : ''}.` : '',
    body.meanTemperatureC ? `Mean surface temperature: ${body.meanTemperatureC} °C.` : '',
    body.atmosphere ? `Atmosphere: ${body.atmosphere}` : '',
    hardware && hardware.hardware.length
      ? `In the scene: ${hardware.hardware.length} pieces of hardware (${Object.entries(hardware.histogram)
          .map(([kind, n]) => `${n} ${kind}`)
          .join(', ')}), of which ${hardware.workingNow} still work.`
      : 'No hardware is attached to this body in the dataset.',
    body.explorationHistory ? `Exploration history: ${body.explorationHistory}` : '',
    body.positionSummary ? `Where it is now: ${body.positionSummary}` : '',
  ];
  return lines.filter(Boolean).join(' ');
}

function moonAnswer(moon) {
  return `${moon.name} — a ${moon.class || 'satellite'} of ${moon.parentName}. Semi-major axis ${fmtNum(
    moon.semiMajorAxisKm
  )} km, orbital period ${moon.orbitalPeriodDays || '—'} days, mean radius ${moon.meanRadiusKm || '—'} km${
    moon.yearDiscovered ? `, discovered in ${moon.yearDiscovered}${moon.discoverer ? ` by ${moon.discoverer}` : ''}` : ''
  }.`;
}

function planList(records, label, limit = 12) {
  const shown = records.slice(0, limit);
  const more = records.length - shown.length;
  return `${label} (${records.length}): ${shown.map((r) => r.name).join(', ')}${
    more > 0 ? `, plus ${more} more — filter the chips to see the rest.` : '.'
  }`;
}

/** Detects what the visitor is asking about. */
function classify(message) {
  const m = message.toLowerCase();
  const has = (...words) => words.some((w) => m.includes(w));

  if (has('compare', ' versus ', ' vs ')) return 'compare';
  // Conceptual questions ("what is a sky crane landing?") are about how things work,
  // not about one record — they need the web, not a fuzzy name match.
  if (has('what is a ', 'what are ', 'how does', 'how do ', 'why does', 'explain', 'what does', 'meaning of', 'difference between'))
    return 'concept';
  // Moons before counting: "how many moons does Jupiter have" is a moons question.
  if (has('moons of', 'how many moons', 'moons does', 'moons are there on', 'natural satellites', 'largest moon', 'biggest moon'))
    return 'moons';
  if (has('station') && has('which', 'list', 'show', 'what', 'biggest', 'largest', 'active', 'working', 'operating', 'today'))
    return 'list-stations';
  if (has('rocket', 'launch vehicle') && has('which', 'list', 'show', 'what', 'flying', 'active', 'today', 'tallest'))
    return 'list-rockets';
  if (has('how many', 'number of', 'count of', 'total number')) return 'count';
  if (has('tallest', 'largest rocket', 'biggest rocket', 'most powerful')) return 'biggest-rocket';
  if (has('which missions', 'what missions', 'list missions', 'missions went', 'missions to', 'missions on', 'what went to', 'which spacecraft'))
    return 'list-missions';
  if (has('which rocket launched', 'what rocket launched', 'launched on which', 'launch vehicle for')) return 'mission-rocket';
  if (has('still working', 'working now', 'is it active', 'still active', 'still operating', 'alive')) return 'status';
  if (has('why did', 'why was', 'how did it end', 'why did it stop', 'why ended', 'stopped working', 'why stop', 'end its mission', 'died'))
    return 'end';
  if (has('achievement', 'achieve', 'discover', 'found', 'accomplish', 'what did it do', 'contribute', 'first to'))
    return 'achievement';
  if (has('where is', 'where did it go', 'current location', 'now located', 'where are they now', 'where is it now', 'position'))
    return 'where';
  if (has('when did', 'launch date', 'launched', 'when was')) return 'launch';
  if (has('status of', 'status')) return 'status';
  if (has('tell me about', 'what is', 'who is', 'about the', 'explain')) return 'about';
  return 'about';
}

function entityMode(kind, intent) {
  const map = {
    status: 'status',
    end: 'end',
    achievement: 'achievement',
    where: 'where',
    launch: 'launch',
    about: 'about',
  };
  if (kind === 'rocket' && intent === 'biggest-rocket') return 'payload';
  return map[intent] || 'about';
}

const KIND_LABEL = {
  mission: 'mission',
  station: 'station',
  rocket: 'launch vehicle',
  body: 'body',
  moon: 'moon',
};

/**
 * Words the candidate extractor must never treat as an object name.
 * Keep in sync with the matcher in store.scoreName.
 */
const NOISE = new Set([
  'and', 'the', 'for', 'are', 'was', 'were', 'its', 'it', 'this', 'that', 'with', 'from',
  'how', 'many', 'much', 'did', 'does', 'what', 'which', 'who', 'when', 'where', 'why',
  'tell', 'about', 'still', 'working', 'work', 'works', 'now', 'mission', 'missions',
  'station', 'stations', 'rocket', 'rockets', 'launch', 'launched', 'vehicle', 'vehicles',
  'moon', 'moons', 'body', 'bodies', 'planet', 'planets', 'compare', 'versus', 'more',
  'achieved', 'achieve', 'achievement', 'stop', 'stopped', 'ended', 'end', 'between',
  'landing', 'landings', 'landed', 'sky', 'crane', 'generator', 'mean', 'means', 'work', 'works',
  'using', 'used', 'make', 'makes', 'made', 'does', 'did', 'called', 'known', 'type', 'types',
]);

/** Pulls candidate entities out of a free-text question. */
function candidatesFrom(message) {
  const found = [];
  // Try the whole tail, then progressively shorter word groups — cheap "longest match first".
  const words = message.replace(/[?.!,]/g, ' ').split(/\s+/).filter(Boolean);
  for (let size = Math.min(4, words.length); size >= 1; size -= 1) {
    for (let i = 0; i + size <= words.length; i += 1) {
      const slice = words.slice(i, i + size);
      // A phrase made only of stopwords ("and", "stations are there") is never an object name.
      if (!slice.some((w) => w.length > 2 && !NOISE.has(w.toLowerCase()))) continue;
      const phrase = slice.join(' ');
      if (phrase.length < 3) continue;
      const hit = store.findEntity(phrase);
      if (hit && !found.some((f) => f.id === hit.id && f.kind === hit.kind)) {
        found.push(hit);
      }
    }
    if (found.length >= 3) break;
  }
  return found
    .sort((a, b) => b.score - a.score || b.name.length - a.name.length)
    .slice(0, 3);
}

function countAnswer(message, entity) {
  const data = store.get();
  const m = message.toLowerCase();
  const body = entity && entity.kind === 'body' ? entity.record : null;

  if (m.includes('station')) return `The dataset holds ${data.stations.length} space stations, ${data.stations.filter((s) => s.workingNow).length} of them working now.`;
  if (m.includes('rocket') || m.includes('launch vehicle'))
    return `The dataset holds ${data.rockets.length} launch vehicles, ${data.rockets.filter((r) => r.flyingToday).length} of them flying today.`;
  if (m.includes('moon')) return `The dataset holds ${data.moons.length} moons across all bodies.`;
  if (body) {
    const hw = store.bodyHardware(body.id);
    return `${body.name} has ${hw.hardware.length} pieces of hardware in the dataset — ${Object.entries(hw.histogram)
      .map(([k, n]) => `${n} ${k}`)
      .join(', ')} — and ${hw.workingNow} of them still work.`;
  }
  if (m.includes('active') || m.includes('working')) return `${data.missions.filter((x) => x.workingNow).length} of ${data.missions.length} missions in the dataset are working now.`;
  return `The dataset holds ${data.missions.length} missions, ${data.stations.length} stations, ${data.rockets.length} launch vehicles, ${data.bodies.length} bodies and ${data.moons.length} moons.`;
}

function buildAnswer(message, context) {
  const data = store.get();
  const intent = classify(message);
  const contexts = [];

  if (context && context.kind && context.id) {
    const maps = store.getMaps();
    const lookup = (kind, id) =>
      kind === 'mission'
        ? maps.missions.get(id)
        : kind === 'station'
          ? maps.stations.get(id)
          : kind === 'rocket'
            ? maps.rockets.get(id)
            : kind === 'moon'
              ? maps.moons.get(id)
              : maps.bodies.get(id);

    let record = lookup(context.kind, context.id);
    let kind = context.kind;
    // The client may hold a stale or partial id; fall back to the name it displayed.
    if (!record && context.name) {
      const hit = store.findEntity(context.name);
      if (hit) {
        record = hit.record;
        kind = hit.kind;
      }
    }
    // A selected object always outranks anything guessed from the text.
    if (record) contexts.push({ kind, id: record.id, name: record.name, record, score: 5000 });
  }

  const found = candidatesFrom(message);
  const ordered = [...contexts, ...found.filter((f) => !contexts.some((c) => c.id === f.id && c.kind === f.kind))];
  const primary = ordered[0] || null;

  // ---- comparison -------------------------------------------------------
  if (intent === 'compare' && ordered.length >= 2) {
    const ranked = ordered.slice().sort((x, y) => (y.score || 0) - (x.score || 0) || y.name.length - x.name.length);
    const [a, b] = ranked;
    const line = (c) => {
      const r = c.record;
      if (c.kind === 'mission')
        return `${r.name}: ${r.type} · ${r.agency} · launched ${r.launchDate || '—'} on ${r.launchVehicle || '—'} · ${statusLine(r)} · target ${r.target}. ${r.achievement || ''}`;
      if (c.kind === 'station') return `${r.name}: ${r.type} · ${r.operator} · first module ${r.firstModuleLaunch || '—'} · ${statusLine(r)}.`;
      if (c.kind === 'rocket') return `${r.name}: ${r.country} · ${r.heightM || '—'} m · ${fmtNum(r.payloadLeoKg)} kg to LEO · ${r.status}.`;
      return `${r.name}: ${r.type || ''} · ${r.meanDistanceAu || '—'} AU.`;
    };
    return {
      answer: `${line(a)}\n\n${line(b)}`,
      refs: ranked.slice(0, 2).map((c) => ({ kind: c.kind, id: c.id, name: c.name })),
    };
  }

  if (intent === 'count') {
    // Only a body reference is useful for a count answer; a stray name match is noise.
    const refs = primary && primary.kind === 'body' ? [{ kind: 'body', id: primary.id, name: primary.name }] : [];
    return { answer: countAnswer(message, primary), refs };
  }

  if (intent === 'biggest-rocket') {
    const tallest = data.rockets.slice().sort((a, b) => (b.heightM || 0) - (a.heightM || 0))[0];
    return { answer: rocketAnswer(tallest, 'payload'), refs: [{ kind: 'rocket', id: tallest.id, name: tallest.name }] };
  }

  if (intent === 'list-rockets') {
    const flying = data.rockets.filter((r) => r.flyingToday);
    const tallest = flying.slice().sort((a, b) => (b.heightM || 0) - (a.heightM || 0))[0];
    return {
      answer: `${flying.length} of ${data.rockets.length} launch vehicles in the dataset are flying today: ${flying
        .slice(0, 12)
        .map((r) => r.name)
        .join(', ')}${flying.length > 12 ? `, plus ${flying.length - 12} more.` : '.'}${
        tallest ? ` The tallest of them is ${tallest.name} at ${tallest.heightM} m.` : ''
      } Retired and planned vehicles are listed in the dataset too — ask about one by name.`,
      refs: flying.slice(0, 3).map((r) => ({ kind: 'rocket', id: r.id, name: r.name })),
    };
  }

  if (intent === 'list-stations') {
    const working = data.stations.filter((s) => s.workingNow);
    const historic = data.stations.filter((s) => !s.workingNow);
    const highlight = data.stations.find((s) => /international space station/i.test(s.name)) || working[0];
    return {
      answer: `${data.stations.length} space stations are in the dataset. Working now (${working.length}): ${working
        .map((s) => s.name)
        .join(', ')}. Historic and deorbited (${historic.length}): ${historic
        .slice(0, 10)
        .map((s) => s.name)
        .join(', ')}${historic.length > 10 ? ', …' : ''}.${
        highlight ? ` Largest and longest-serving: ${highlight.name} — ${highlight.achievement || highlight.story || ''}` : ''
      }`,
      refs: (working.length ? working : data.stations).slice(0, 3).map((s) => ({ kind: 'station', id: s.id, name: s.name })),
    };
  }

  if (intent === 'moons') {
    const body =
      primary && primary.kind === 'body'
        ? primary.record
        : data.bodies.find((b) => message.toLowerCase().includes(b.name.toLowerCase())) || store.findEntity(message)?.record;
    if (body && body.id && store.getMaps().moonsByParent.get(body.id)) {
      const moons = store.getMaps().moonsByParent.get(body.id);
      const named = moons.slice().sort((a, b) => (b.meanRadiusKm || 0) - (a.meanRadiusKm || 0)).slice(0, 8);
      return {
        answer: `${body.name} has ${moons.length} moons in the dataset (the workbook reports ${body.moonsConfirmed || 0} IAU-confirmed). Largest: ${named
          .map((m) => `${m.name}${m.meanRadiusKm ? ` (${fmtNum(m.meanRadiusKm)} km radius)` : ''}`)
          .join(', ')}.`,
        refs: [{ kind: 'body', id: body.id, name: body.name }],
      };
    }
    const total = data.moons.length;
    return { answer: `The dataset tracks ${total} moons. Ask about a specific body, for example "moons of Saturn".`, refs: [] };
  }

  if (intent === 'list-missions') {
    const body = primary && primary.kind === 'body' ? primary.record : data.bodies.find((b) => message.toLowerCase().includes(b.name.toLowerCase()));
    if (body) {
      const list = store.getMaps().missionsByBody.get(body.id) || [];
      const active = list.filter((m) => m.workingNow);
      return {
        answer: `${planList(list, `Missions targeting ${body.name}`)} ${active.length ? `${active.length} are still working (${active.slice(0, 6).map((m) => m.name).join(', ')}${active.length > 6 ? ', …' : ''}).` : 'None are still working.'}`,
        refs: [{ kind: 'body', id: body.id, name: body.name }],
      };
    }
    const active = data.missions.filter((m) => m.workingNow);
    return { answer: planList(active, 'Missions working now'), refs: [] };
  }

  if (intent === 'mission-rocket' && primary && primary.kind === 'mission') {
    const vehicle = primary.record.launchVehicle;
    const rocket = vehicle ? store.findEntity(vehicle) : null;
    return {
      answer: `${primary.record.name} launched on a ${vehicle || 'vehicle that is not recorded'} on ${primary.record.launchDate || '—'}.${
        rocket ? ` ${rocketAnswer(rocket.record, 'about')}` : ''
      }`,
      refs: [{ kind: 'mission', id: primary.id, name: primary.name }, ...(rocket ? [{ kind: 'rocket', id: rocket.id, name: rocket.name }] : [])],
    };
  }

  if (primary) {
    if (primary.kind === 'body') {
      const subset = subsetAnswer(primary.record, message, intent);
      if (subset) return subset;
    }

    const mode = entityMode(primary.kind, intent);
    const answer =
      primary.kind === 'mission'
        ? missionAnswer(primary.record, mode)
        : primary.kind === 'station'
          ? stationAnswer(primary.record, mode)
          : primary.kind === 'rocket'
            ? rocketAnswer(primary.record, mode)
            : primary.kind === 'moon'
              ? moonAnswer(primary.record)
              : bodyAnswer(primary.record);
    return {
      answer,
      refs: ordered.map((c) => ({ kind: c.kind, id: c.id, name: c.name })),
      // How strongly the question matched a record — the service uses this to decide
      // whether a conceptual question should lead with web background instead.
      confidence: primary.score || 0,
      primaryKind: primary.kind,
      intent,
    };
  }

  return {
    answer: [
      `I could not match that to a record in the dataset of ${data.missions.length} missions, ${data.stations.length} stations, ${data.rockets.length} launch vehicles and ${data.bodies.length} bodies.`,
      'If you were asking about a concept rather than a mission, the answer will come from the web instead.',
      'Try: "which missions went to Mars?", "is Voyager 1 still working?", "what did Cassini achieve?", "tallest rocket", "moons of Saturn", or click an object in the scene and ask "why did it stop?".',
    ].join(' '),
    refs: [],
    confidence: 0,
    primaryKind: null,
    intent,
  };
}

function suggestionsFor(context) {
  if (context && context.kind === 'mission') {
    return [
      'Is it still working?',
      'What did it achieve?',
      'Where is it now?',
      'Which rocket launched it?',
    ];
  }
  if (context && context.kind === 'body') {
    return [
      `Which missions went to ${context.name}?`,
      `How many moons does ${context.name} have?`,
      `How much hardware is at ${context.name}?`,
    ];
  }
  return ['Which missions went to Mars?', 'Is Voyager 1 still working?', 'What did Cassini achieve?', 'Tallest rocket'];
}

function references(records) {
  return records
    .filter((r) => r && r.record && r.record.referenceUrl)
    .map((r) => ({ label: r.record.name, url: r.record.referenceUrl }));
}

module.exports = { buildAnswer, suggestionsFor, references, classify };
