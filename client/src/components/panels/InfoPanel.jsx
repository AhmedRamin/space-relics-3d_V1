import { useEffect, useRef, useState } from 'react';
import { KINDS, STATUSES, PRECISION } from '../../lib/constants';
import { formatAu, formatNumber } from '../../lib/scale';

/** One label/value row. Hidden when the dataset has no value for it. */
function Fact({ label, value }) {
  if (value === null || value === undefined || value === '' || value === '—') return null;
  return (
    <div className="info-grid__cell">
      <span className="info-grid__label">{label}</span>
      <span className="info-grid__value">{value}</span>
    </div>
  );
}

function statusBadge(item) {
  const meta = STATUSES[item.statusGroup] || STATUSES.ended;
  return (
    <span className={`badge badge--${item.statusGroup}`}>
      <span className="badge__dot" aria-hidden="true" />
      {item.status || meta.label}
    </span>
  );
}

const xmlEscape = (text) =>
  String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * A generated card used when nothing has a photograph. It is a real <img> source, so the
 * panel always has a picture area instead of an empty frame — and it cannot fail to load.
 */
function placeholderImage({ name, label, color }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${xmlEscape(color)}" stop-opacity="0.42"/>
      <stop offset="0.6" stop-color="#0a1226"/>
      <stop offset="1" stop-color="#05070f"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.78" cy="0.22" r="0.6">
      <stop offset="0" stop-color="${xmlEscape(color)}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#05070f" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="400" fill="url(#bg)"/>
  <rect width="640" height="400" fill="url(#glow)"/>
  <circle cx="500" cy="120" r="86" fill="none" stroke="${xmlEscape(color)}" stroke-opacity="0.5" stroke-width="2"/>
  <circle cx="500" cy="120" r="128" fill="none" stroke="${xmlEscape(color)}" stroke-opacity="0.22" stroke-width="2"/>
  <text x="40" y="252" fill="#f2f6ff" font-family="Inter, Segoe UI, sans-serif" font-size="34" font-weight="700">${xmlEscape(name)}</text>
  <text x="40" y="292" fill="#b3c0dc" font-family="Inter, Segoe UI, sans-serif" font-size="19">${xmlEscape(label)}</text>
  <text x="40" y="344" fill="#7e8cab" font-family="Inter, Segoe UI, sans-serif" font-size="16">No photograph is recorded in the dataset for this object</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Picture block that always resolves to an image.
 *
 * It walks an ordered list of candidates: the object's own photograph → its destination
 * body's photograph → a generated SVG card. A photograph that fails to load (offline,
 * blocked, dead URL) advances to the next candidate instead of leaving a broken frame,
 * so clicking any satellite / rover always reveals a picture.
 */
function RecordImage({ candidates, alt, fallbackColor, icon, name, label }) {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const signature = candidates.map((c) => c.src || '').join('|');

  useEffect(() => {
    setIndex(0);
    setLoaded(false);
  }, [signature]);

  const active = candidates[Math.min(index, candidates.length - 1)] || {};
  const isPhoto = Boolean(active.src) && !active.generated;
  const src = active.src || placeholderImage({ name, label, color: fallbackColor || '#5ea8ff' });

  return (
    <figure className={`record-image${isPhoto ? '' : ' record-image--generated'}`}>
      <div className="record-image__frame">
        <img
          key={src}
          src={src}
          alt={alt}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            setLoaded(false);
            setIndex((current) => Math.min(current + 1, candidates.length - 1));
          }}
          onLoad={() => setLoaded(true)}
        />
        {!loaded ? <div className="record-image__skeleton" aria-hidden="true" /> : null}
        <span className="record-image__glare" aria-hidden="true" />
      </div>
      <figcaption>
        {isPhoto ? (
          <>
            <span className="record-image__cap">
              {active.caption ? <strong>{active.caption}</strong> : null}
              {active.credit ? <span className="muted"> · {active.credit}</span> : null}
            </span>
            {active.note ? <span className="record-image__note">{active.note}</span> : null}
          </>
        ) : (
          <span>
            <span aria-hidden="true">{icon} </span>
            Illustration — no photograph is recorded for this object
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/** Record for the selected object, including the photograph and its position. */
export function InfoPanel({ selected, onClose, onAsk, onFocusBody, bodyNames, bodyImages = {}, isPhone }) {
  const scrollRef = useRef(null);
  const selectionKey = selected ? `${selected.kind}-${selected.id}` : null;

  // The panel keeps its DOM between selections, so scroll position used to carry over and the
  // photograph was left scrolled out of view. Reset it whenever a different object is selected.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [selectionKey]);

  if (!selected) return null;
  const d = selected.data || {};
  const isBody = selected.kind === 'body';
  const bodyName = d.bodyId ? bodyNames[d.bodyId] : null;
  const kindMeta = isBody ? null : KINDS[d.visualKind] || KINDS.probe;

  // Picture candidates, in priority order: the object's own photograph, then its
  // destination body's photograph. The panel appends a generated card itself if both fail.
  const candidates = [];
  if (d.imageUrl) {
    candidates.push({
      src: d.imageUrl,
      credit: d.imageCredit || 'Wikimedia Commons',
      caption: d.type || d.operator || (kindMeta ? kindMeta.label : null),
      note: d.imageNote || null,
    });
  }
  const bodyImage = d.bodyId ? bodyImages[d.bodyId] : null;
  if (bodyImage && bodyImage !== d.imageUrl) {
    candidates.push({
      src: bodyImage,
      credit: 'Wikimedia Commons',
      caption: `${bodyName || 'Destination'} — no photograph of this ${selected.kind} is recorded`,
    });
  }

  const precision = isBody ? null : PRECISION[item(d) || 'unlocated'] || PRECISION.unlocated;

  return (
    <aside className="info-panel" aria-label="Object details">
      {isPhone ? (
        <span className="info-panel__handle" aria-hidden="true">
          <i />
        </span>
      ) : null}

      <div className="info-panel__scroll" ref={scrollRef} key={selectionKey || 'empty'}>
        <div className="info-panel__top">
          <span className="eyebrow">
            {kindMeta ? (
              <>
                <span aria-hidden="true">{kindMeta.icon}</span> {kindMeta.label}
              </>
            ) : (
              'World'
            )}
          </span>
          <button type="button" className="btn btn--sm btn--ghost info-panel__close" onClick={onClose} aria-label="Close details">
            ✕
          </button>
        </div>

        <h1 className="info-panel__title">{selected.name}</h1>

        <RecordImage
          candidates={candidates}
          alt={`Photograph of ${selected.name}`}
          name={selected.name}
          label={d.type || d.operator || (kindMeta ? kindMeta.label : 'Object')}
          fallbackColor={kindMeta ? kindMeta.color : '#5ea8ff'}
          icon={kindMeta ? kindMeta.icon : '🪐'}
        />

        <div className="row">
          {isBody ? (
            <>
              <span className="badge">{d.type}</span>
              {d.moonsConfirmed ? <span className="badge">{d.moonsConfirmed} moons confirmed</span> : null}
            </>
          ) : (
            <>
              {statusBadge(d)}
              <span className="tag">{d.workingNow ? 'working now' : d.workingNowText || 'not working'}</span>
            </>
          )}
        </div>

        {isBody ? (
          <>
            <div className="info-grid">
              <Fact label="Mean distance" value={formatAu(d.meanDistanceAu)} />
              <Fact label="Diameter" value={d.diameterKm ? `${formatNumber(d.diameterKm)} km` : null} />
              <Fact label="Day length" value={d.rotationPeriodHours ? `${formatNumber(d.rotationPeriodHours, 1)} h` : null} />
              <Fact label="Axial tilt" value={d.axialTiltDeg ? `${d.axialTiltDeg}°` : null} />
              <Fact label="Temperature" value={d.meanTemperatureC} />
              <Fact label="Ring system" value={d.ringSystem} />
              <Fact label="Hardware in scene" value={d.hardware ?? (d.total || null)} />
              <Fact label="Working now" value={d.workingNow} />
            </div>
            {d.atmosphere ? (
              <div className="info-section">
                <span className="eyebrow">Atmosphere</span>
                <p className="small">{d.atmosphere}</p>
              </div>
            ) : null}
            {d.explorationHistory ? (
              <div className="info-section">
                <span className="eyebrow">Exploration history</span>
                <p className="small">{d.explorationHistory}</p>
              </div>
            ) : null}
            {d.positionSummary ? (
              <div className="info-section">
                <span className="eyebrow">Where it is now</span>
                <p className="small">{d.positionSummary}</p>
              </div>
            ) : null}
            {d.id !== 'moon' ? (
              <button type="button" className="btn btn--primary info-panel__cta" onClick={() => onFocusBody(d)}>
                Explore hardware at {selected.name} →
              </button>
            ) : null}
          </>
        ) : (
          <>
            {precision ? (
              <div className="position-chip" title={precision.description}>
                <span aria-hidden="true">{precision.symbol}</span>
                <div>
                  <strong>{precision.label}</strong>
                  {d.location ? (
                    <div className="mono small">
                      {Math.abs(d.location.lat).toFixed(4)}°{d.location.lat >= 0 ? 'N' : 'S'},{' '}
                      {Math.abs(d.location.lng).toFixed(4)}°{d.location.lng >= 0 ? 'E' : 'W'}
                      {d.location.label ? ` — ${d.location.label}` : ''}
                    </div>
                  ) : d.orbit ? (
                    <div className="mono small">
                      {d.orbit.altitudeKm !== null && d.orbit.altitudeKm !== undefined
                        ? `${formatNumber(d.orbit.altitudeKm)} km${d.orbit.inclinationDeg !== null && d.orbit.inclinationDeg !== undefined ? ` · ${d.orbit.inclinationDeg}° inclination` : ''}`
                        : d.orbit.label}
                    </div>
                  ) : (
                    <div className="mono small">Shown on a shell around {d.bodyId ? bodyNames[d.bodyId] : 'the body'}</div>
                  )}
                  {d.coordinateSource ? <div className="small muted">Source: {d.coordinateSource}</div> : null}
                </div>
              </div>
            ) : null}

            <div className="info-grid">
              <Fact label="Hardware type" value={d.type} />
              <Fact label="Agency / operator" value={d.agency || d.operator} />
              <Fact label="Destination" value={d.target || (d.bodyId ? bodyNames[d.bodyId] : null)} />
              <Fact label="Launched" value={d.launchDate || d.firstModuleLaunch} />
              <Fact label="Launch vehicle" value={d.launchVehicle} />
              <Fact label="Orbit" value={d.orbit ? d.orbit.label : d.orbitName} />
              <Fact label="Current location" value={d.currentLocation} />
            </div>

            {d.achievement ? (
              <div className="info-section">
                <span className="eyebrow">What it achieved</span>
                <p className="small">{d.achievement}</p>
              </div>
            ) : null}

            {d.story ? (
              <div className="info-section">
                <span className="eyebrow">Story</span>
                <p className="small">{d.story}</p>
              </div>
            ) : null}

            <div className="info-panel__actions">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => onAsk({ kind: selected.kind, id: selected.id, name: selected.name }, 'Is it still working?')}
              >
                Ask the guide
              </button>
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => onAsk({ kind: selected.kind, id: selected.id, name: selected.name }, 'Where is it now?')}
              >
                Where is it now?
              </button>
              {d.referenceUrl ? (
                <a className="btn btn--sm" href={d.referenceUrl} target="_blank" rel="noreferrer noopener">
                  ↗ Reference
                </a>
              ) : null}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

const SURFACE_KINDS = ['rover', 'helicopter', 'lander', 'impactor'];

/**
 * The precision code the panel should show for a hardware record.
 *
 * A surface vehicle must never be described as an orbit: a planned rover has a chosen landing
 * site and no altitude, which previously produced "Orbit altitude not published" next to the
 * coordinates of that site.
 */
function item(d) {
  const isSurface = SURFACE_KINDS.includes(d.visualKind);
  if (d.location) return d.positionPrecision || 'measured';
  if (isSurface) return 'unlocated';
  if (d.orbit) return d.positionPrecision || 'shell';
  return 'shell';
}
