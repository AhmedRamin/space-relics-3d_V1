import { KINDS } from '../../lib/constants';
import { IconTypePanel } from './IconTypePanel';

/**
 * Left rail: the bodies (or the hardware at the current body) plus the hardware icon types.
 * On phones the whole rail is a slide-over drawer; the shell handles the backdrop.
 */
export function Sidebar({
  view,
  bodies,
  current,
  hardware,
  selectedId,
  onFocusBody,
  onSelect,
  kindFilter,
  setKindFilter,
  workingOnly,
  setWorkingOnly,
  showDwarfs,
  setShowDwarfs,
  facets,
  renderAll,
  setRenderAll,
  onClose,
  isPhone,
}) {
  const visible = hardware.filter((item) => {
    if (kindFilter && item.visualKind !== kindFilter) return false;
    if (workingOnly && !item.workingNow) return false;
    return true;
  });

  const DETAIL_THRESHOLD = 18;

  return (
    <aside className="sidebar" aria-label="Explorer panels">
      {isPhone && onClose ? (
        <div className="sidebar__head">
          <span className="eyebrow">Explore</span>
          <button type="button" className="btn btn--sm btn--ghost" onClick={onClose} aria-label="Close panels">
            ✕
          </button>
        </div>
      ) : null}

      <section className="sidebar__section">
        <div className="sidebar__title">
          <span className="eyebrow">{view.mode === 'body' ? 'Hardware here' : 'Bodies'}</span>
          <span className="row" style={{ gap: 6 }}>
            {view.mode === 'body' && visible.length > DETAIL_THRESHOLD ? (
              <button
                type="button"
                className={`chip${renderAll ? ' chip--on' : ''}`}
                onClick={() => setRenderAll(!renderAll)}
                title={
                  renderAll
                    ? 'Showing full detail on every object — click for the lighter set'
                    : `All ${visible.length} objects are drawn; click for full detail on each`
                }
              >
                {renderAll ? '◉ full detail' : '◌ light detail'}
              </button>
            ) : null}
            <span className="small muted">{view.mode === 'body' ? visible.length : bodies.length}</span>
          </span>
        </div>

        <div className="sidebar__scroll">
          {view.mode === 'body'
            ? visible.map((item) => {
                const kind = KINDS[item.visualKind] || KINDS.probe;
                const place = item.location ? '◎' : item.orbit ? '◉' : '≈';
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`row-item${selectedId === item.id ? ' row-item--on' : ''}`}
                    style={{ '--row': kind.color }}
                    onClick={() => onSelect(item)}
                    title={item.location ? item.location.label : item.orbit ? item.orbit.label : 'Position not published'}
                  >
                    <span className="row-item__icon" aria-hidden="true">{kind.icon}</span>
                    <span className="row-item__text">
                      <strong>{item.name}</strong>
                      <span className="small muted">{item.type || kind.label}</span>
                    </span>
                    <span className={`row-item__dot${item.workingNow ? ' row-item__dot--live' : ''}`} aria-hidden="true" />
                    <span className="row-item__place small muted" aria-hidden="true">{place}</span>
                  </button>
                );
              })
            : bodies.map((body) => (
                <button key={body.id} type="button" className="row-item" onClick={() => onFocusBody(body)} title={body.type}>
                  <span className="row-item__icon" aria-hidden="true">{body.isDwarf ? '🪨' : body.id === 'sun' ? '☀️' : '🪐'}</span>
                  <span className="row-item__text">
                    <strong>{body.name}</strong>
                    <span className="small muted">{body.type}</span>
                  </span>
                  <span className="row-item__badge">{body.total || 0}</span>
                </button>
              ))}

          {view.mode === 'body' && !visible.length ? (
            <p className="small muted" style={{ padding: '0 12px' }}>
              No hardware matches the current filters.
            </p>
          ) : null}
        </div>
      </section>

      <IconTypePanel
        kinds={(facets && facets.kinds) || []}
        kindFilter={kindFilter}
        setKindFilter={setKindFilter}
        workingOnly={workingOnly}
        setWorkingOnly={setWorkingOnly}
        showDwarfs={showDwarfs}
        setShowDwarfs={setShowDwarfs}
        counts={facets && facets.counts}
      />

      {current ? (
        <div className="sidebar__foot small muted">
          Viewing <strong style={{ color: 'var(--text-secondary)' }}>{current.name}</strong> · press Esc for the Solar System
        </div>
      ) : null}
    </aside>
  );
}
