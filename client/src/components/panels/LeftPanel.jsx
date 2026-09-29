import { KINDS, KIND_ORDER, PRECISION } from '../../lib/constants';
import { formatNumber } from '../../lib/scale';

const SURFACE = ['rover', 'helicopter', 'lander', 'impactor'];

/** Body list (system view) or hardware list (body view). */
export function LeftPanel({
  view,
  bodies,
  current,
  hardware,
  selectedId,
  onFocusBody,
  onSelect,
  kindFilter,
  workingOnly,
  renderAll,
  setRenderAll,
}) {
  if (view.mode === 'system') {
    return (
      <div className="hud hud--left-top panel scroll">
        <div className="stack" style={{ gap: 8 }}>
          <div className="spread">
            <span className="eyebrow">Bodies</span>
            <span className="small muted">{bodies.length}</span>
          </div>
          {bodies.map((body) => (
            <button key={body.id} type="button" className="body-chip" onClick={() => onFocusBody(body)} title={body.type}>
              <span>
                {body.name}
                <br />
                <span className="small muted">{body.type}</span>
              </span>
              <span className="body-chip__count">{body.total || '—'}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const visible = hardware.filter((item) => {
    if (kindFilter && item.visualKind !== kindFilter) return false;
    if (workingOnly && !item.workingNow) return false;
    return true;
  });

  const located = visible.filter((item) => item.location || item.orbit).length;

  return (
    <div className="hud hud--left-top panel scroll">
      <div className="stack" style={{ gap: 8 }}>
        <div className="spread">
          <span className="eyebrow">At {current?.name}</span>
          <span className="small muted">{visible.length}</span>
        </div>
        <span className="small muted">
          {located} of {visible.length} have a published position ({Math.round((located / Math.max(1, visible.length)) * 100)}%)
        </span>

        {visible.length > 34 ? (
          <button type="button" className={`chip${renderAll ? ' chip--on' : ''}`} onClick={() => setRenderAll(!renderAll)}>
            {renderAll ? '◉' : '○'} Render all {visible.length} in 3D
          </button>
        ) : null}

        {visible.map((item) => {
          const place = item.location ? PRECISION[item.positionPrecision || 'measured'] : item.orbit ? PRECISION[item.positionPrecision || 'shell'] : PRECISION.unlocated;
          return (
            <button
              key={item.id}
              type="button"
              className={`hardware-row${selectedId === item.id ? ' hardware-row--on' : ''}`}
              onClick={() => onSelect(item)}
              title={item.location ? `${item.location.label} (${item.location.lat}, ${item.location.lng})` : item.orbit ? item.orbit.label : 'Position not published'}
            >
              <span
                className="hardware-row__dot"
                style={{ background: (KINDS[item.visualKind] || KINDS.probe).color }}
                aria-hidden="true"
              />
              <span className="hardware-row__name">{item.name}</span>
              <span className="tag" title={place?.description}>
                {place ? place.symbol : ''} {item.workingNow ? 'working' : item.statusGroup}
              </span>
            </button>
          );
        })}

        {!visible.length ? <p className="small muted">No hardware matches the current filters.</p> : null}
      </div>
    </div>
  );
}

export function Legend({ kinds }) {
  const present = KIND_ORDER.filter((kind) => kinds.some((k) => k.value === kind));
  const list = present.length ? present : KIND_ORDER;

  return (
    <div className="hud hud--left-bottom panel" style={{ maxWidth: 216 }}>
      <div className="stack" style={{ gap: 5 }}>
        <span className="eyebrow">Hardware types</span>
        {list.map((kind) => (
          <span key={kind} className="legend-item">
            <span className="legend-swatch" style={{ background: KINDS[kind].color }} aria-hidden="true" />
            <span aria-hidden="true">{KINDS[kind].icon}</span> {KINDS[kind].label}
          </span>
        ))}
        <span className="legend-item muted small">● ring = still working · ○ disc = ended</span>
        <span className="legend-item muted small">◎ measured site · ◉ reported · ◍ approximate · ≈ unpublished</span>
      </div>
    </div>
  );
}

export function Hint() {
  return (
    <div className="hint">
      Drag to orbit · Scroll to zoom · Click a vehicle to fly to it and read its record · Esc returns to the Solar System
    </div>
  );
}

export { formatNumber };
