const { buildAnswer, suggestionsFor, references } = require('./answerEngine');
const web = require('./webKnowledge');
const models = require('./modelProviders');
const store = require('./../data/store');

/**
 * The guide's answer pipeline.
 *
 *   1. the dataset answers first (authoritative, always available)
 *   2. the internet fills conceptual gaps the dataset cannot cover
 *   3. a model rewords the retrieved material, if one is configured
 *
 * Every answer reports which sources were used, and the model is never allowed to
 * introduce facts — only to phrase the retrieved material.
 */

const CONCEPTUAL = ['what is', 'what are', 'how does', 'how do', 'why does', 'why do', 'explain', 'difference between', 'meaning of'];

const isConceptual = (message) => {
  const m = String(message || '').toLowerCase();
  return CONCEPTUAL.some((phrase) => m.includes(phrase));
};

/** Should we also ask the web? */
function needsWeb(message, grounded, useWeb) {
  if (useWeb === false || !web.enabled()) return false;
  // No dataset match at all, or a conceptual question the dataset cannot explain.
  if (!grounded.refs || grounded.refs.length === 0) return true;

  const m = String(message || '').toLowerCase();
  // "why do rovers stop working" is about mechanism, not about one record.
  const whyMechanism = /\bwhy\b/.test(m) && /(stop|fail|die|work|end|survive|last)/.test(m);
  if (whyMechanism && (!grounded.primaryKind || grounded.primaryKind === 'body')) return true;

  return isConceptual(message) && (grounded.confidence || 0) < 200;
}

function refRecords(refs) {
  const maps = store.getMaps();
  return refs
    .map((ref) => {
      const record =
        ref.kind === 'mission'
          ? maps.missions.get(ref.id)
          : ref.kind === 'station'
            ? maps.stations.get(ref.id)
            : ref.kind === 'rocket'
              ? maps.rockets.get(ref.id)
              : ref.kind === 'moon'
                ? maps.moons.get(ref.id)
                : maps.bodies.get(ref.id);
      return record ? { ...ref, record } : null;
    })
    .filter(Boolean);
}

async function answer({ message, context, history = [], useWeb = true }) {
  const grounded = buildAnswer(message, context);
  const refs = grounded.refs || [];
  const records = refRecords(refs);

  const sources = [
    {
      id: 'dataset',
      label: 'Your database',
      detail: `${store.countsFor('missions')} missions · ${store.countsFor('stations')} stations · ${store.countsFor('rockets')} rockets`,
    },
  ];
  const citations = references(records);

  // ---- internet -----------------------------------------------------------
  let webResult = { used: false, extracts: [] };
  if (needsWeb(message, grounded, useWeb)) {
    webResult = await web.lookup(web.searchPhrase(message), { limit: 2 });
  }

  if (webResult.used) {
    sources.push({
      id: 'web',
      label: 'Internet (Wikipedia)',
      detail: webResult.extracts.map((e) => e.title).join(', '),
    });
    webResult.extracts.forEach((e) => citations.push({ label: e.title, url: e.url }));
  }

  // ---- compose ------------------------------------------------------------
  // A conceptual question that only weakly matched a record should lead with the
  // explanation, and mention the dataset records afterwards as related objects.
  const webLeads = webResult.used && isConceptual(message) && (grounded.confidence || 0) < 200;

  const webText = webResult.used
    ? webResult.extracts.map((e) => `${e.title}: ${e.extract}`).join('\n\n')
    : '';

  let answerText;
  // Lead with the web only when the dataset answer is weak: a strong dataset answer
  // (an exact record, or a hardware subset) always comes first.
  const whyLeads = webResult.used && /\bwhy\b/.test(message.toLowerCase()) && (grounded.confidence || 0) < 500;

  if (webLeads || whyLeads) {
    const related = refs.length
      ? `\n\nIn this dataset you can see related records: ${refs.map((r) => r.name).join(', ')}.`
      : '';
    answerText = `${webText}${related}`;
  } else {
    answerText = [grounded.answer, webResult.used && webText ? `For background, from the wider web:\n${webText}` : '']
      .filter(Boolean)
      .join('\n\n');
  }
  let modelUsed = 'none';

  const material = [
    webLeads ? '' : `DATASET ANSWER:\n${grounded.answer}`,
    webLeads && refs.length ? `RELATED DATASET RECORDS: ${refs.map((r) => r.name).join(', ')}` : '',
    webResult.used ? `WEB EXTRACTS:\n${webResult.extracts.map((e) => `${e.title}: ${e.extract}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const reworded = await models.reword({ question: message, material, history });
  if (reworded) {
    answerText = reworded.text;
    modelUsed = reworded.provider;
    sources.push({
      id: 'model',
      label: reworded.provider === 'paid' ? 'AI model (keyed)' : 'Free AI model',
      detail: reworded.provider === 'paid' ? process.env.AI_MODEL || 'gpt-4o-mini' : models.describe().free,
    });
  } else {
    sources.push({ id: 'offline', label: 'Data only', detail: 'No model reachable — answered from the dataset and Wikipedia' });
  }

  const notes = [];
  if (webResult.error) notes.push('The internet lookup was unavailable, so this answer is from the local database only.');
  if (!models.describe().any) notes.push('Add FREE_MODEL_URL or AI_API_KEY to server/.env to enable AI rewording.');

  return {
    ok: true,
    answer: answerText,
    groundedAnswer: grounded.answer,
    refs,
    citations: citations.slice(0, 6),
    sources,
    suggestions: suggestionsFor(context),
    activeObject: context || null,
    mode: modelUsed === 'none' ? (webResult.used ? 'dataset+web' : 'dataset') : `dataset+web+${modelUsed}`,
    webUsed: webResult.used,
    webTitles: webResult.extracts.map((e) => e.title),
    modelUsed,
    notes: notes.join(' '),
    engines: models.describe(),
    datasetCounts: store.get().meta.counts || {},
  };
}

module.exports = { answer, needsWeb };
